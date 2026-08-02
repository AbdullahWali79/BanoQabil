import { supabase } from '@/lib/supabase';
import { relationOne } from '@/features/teacher/utils/teacherData';
import {
  createReportDoc,
  defaultTableStyles,
  lastTableY,
  moneyPKR,
  monthLabel,
  paintFooters,
  paintReportHeader,
  paintSectionTitle,
  paintSummaryBar,
  parseMonthValue,
  type ReportTheme,
} from '@/lib/reportPdf';

function monthBounds(monthValue: string) {
  const { year, month } = parseMonthValue(monthValue);
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return {
    year,
    month,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    label: monthLabel(year, month),
  };
}

export type SystemReportOptions = {
  monthValue: string;
  /** Super Admin: include staff payroll pages */
  includeStaffPay?: boolean;
  footerNote?: string;
  theme?: ReportTheme;
  filePrefix?: string;
};

/** Builds & downloads a multi-page full system PDF. */
export async function downloadSystemReportPdf(opts: SystemReportOptions) {
  const bounds = monthBounds(opts.monthValue);
  const theme = opts.theme ?? 'blue';
  const { year: y, month: m } = bounds;

  let studentsRaw: Record<string, unknown>[] = [];
  {
    const withFree = await supabase.from('students').select(`
      id, gender, course_id, batch_id, application_id,
      profiles(full_name, email, status, phone),
      courses(name, initial_fee, monthly_fee, is_free)
    `);
    if (withFree.error && /is_free|application_id/i.test(withFree.error.message)) {
      const fallback = await supabase.from('students').select(`
        id, gender, course_id, batch_id,
        profiles(full_name, email, status, phone),
        courses(name, initial_fee, monthly_fee)
      `);
      if (fallback.error) throw fallback.error;
      studentsRaw = (fallback.data ?? []) as Record<string, unknown>[];
    } else if (withFree.error) {
      throw withFree.error;
    } else {
      studentsRaw = (withFree.data ?? []) as Record<string, unknown>[];
    }
  }

  const [
    { data: coursesRaw },
    { data: batchesRaw },
    { data: profilesRaw },
    { data: monthAssignments },
    { data: monthAttendance },
    { data: feePayments },
    { data: teachersRaw },
    { count: assignmentAll },
    { count: submissionAll },
    { count: attendanceAll },
    { count: pendingGradeAll },
  ] = await Promise.all([
    supabase.from('courses').select('id, name, initial_fee, monthly_fee, is_free'),
    supabase.from('batches').select('id, name, course_id, teacher_id, courses(name)'),
    supabase.from('profiles').select('id, status, full_name, email, phone, roles(name)'),
    supabase
      .from('assignments')
      .select('id, teacher_id, created_at')
      .gte('created_at', bounds.startIso)
      .lte('created_at', bounds.endIso),
    supabase
      .from('attendance')
      .select('status, attendance_date, teacher_id')
      .gte('attendance_date', bounds.startDate)
      .lte('attendance_date', bounds.endDate),
    supabase
      .from('student_fee_payments')
      .select('payment_type, year, month, amount, status')
      .eq('status', 'Paid'),
    supabase
      .from('teachers')
      .select(
        'id, profile_id, profiles(full_name, email, status), teacher_courses(gender_scope, courses(name))',
      ),
    supabase.from('assignments').select('id', { count: 'exact', head: true }),
    supabase.from('submissions').select('id', { count: 'exact', head: true }),
    supabase.from('attendance').select('id', { count: 'exact', head: true }),
    supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .is('marks', null),
  ]);

  const students = studentsRaw.map((row) => {
    const profile = relationOne(row.profiles as never) as {
      full_name?: string;
      email?: string;
      status?: string;
      phone?: string;
    } | null;
    const course = relationOne(row.courses as never) as {
      name?: string;
      initial_fee?: number;
      monthly_fee?: number;
      is_free?: boolean;
    } | null;
    return {
      id: String(row.id),
      gender: String(row.gender || '—'),
      courseId: (row.course_id as string | null) ?? null,
      batchId: (row.batch_id as string | null) ?? null,
      applicationId: (row.application_id as string | null) ?? null,
      name: profile?.full_name || 'Student',
      email: profile?.email || '—',
      phone: profile?.phone || '—',
      status: profile?.status || '—',
      courseName: course?.name || 'No Course',
      isFree: Boolean(course?.is_free),
      initialFee: Number(course?.initial_fee ?? 0),
      monthlyFee: Number(course?.monthly_fee ?? 0),
    };
  });

  const approvedStudents = students.filter((s) => s.status === 'Approved');
  const pendingStudents = students.filter((s) => s.status === 'Pending');
  const suspendedStudents = students.filter((s) => s.status === 'Suspended');
  const male = approvedStudents.filter(
    (s) => /male/i.test(s.gender) && !/female/i.test(s.gender),
  ).length;
  const female = approvedStudents.filter((s) => /female/i.test(s.gender)).length;
  const noCourse = approvedStudents.filter((s) => !s.courseId).length;
  const noBatch = approvedStudents.filter((s) => !s.batchId).length;

  const courses = (coursesRaw ?? []) as Array<{
    id: string;
    name: string;
    initial_fee?: number | null;
    monthly_fee?: number | null;
    is_free?: boolean | null;
  }>;

  const courseEnrollment = courses
    .map((c) => {
      const enrolled = approvedStudents.filter((s) => s.courseId === c.id);
      return {
        name: c.name,
        students: enrolled.length,
        male: enrolled.filter((s) => /male/i.test(s.gender) && !/female/i.test(s.gender)).length,
        female: enrolled.filter((s) => /female/i.test(s.gender)).length,
        free: Boolean(c.is_free),
        monthly: Number(c.monthly_fee ?? 0),
        initial: Number(c.initial_fee ?? 0),
      };
    })
    .sort((a, b) => b.students - a.students);

  const batches = (batchesRaw ?? []).map((b: Record<string, unknown>) => {
    const course = relationOne(b.courses as never) as { name?: string } | null;
    const count = approvedStudents.filter((s) => s.batchId === b.id).length;
    return {
      name: String(b.name || 'Batch'),
      course: course?.name || '—',
      students: count,
      hasTeacher: Boolean(b.teacher_id),
    };
  });

  const roleCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};
  const admins: Array<{ name: string; email: string; phone: string; status: string }> = [];
  for (const row of (profilesRaw ?? []) as Array<Record<string, unknown>>) {
    const roleRel = relationOne(row.roles as never) as { name?: string } | null;
    const roleName = roleRel?.name || 'Unknown';
    const status = String(row.status || 'Unknown');
    roleCounts[roleName] = (roleCounts[roleName] || 0) + 1;
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    if (roleName === 'Admin') {
      admins.push({
        name: String(row.full_name || 'Admin'),
        email: String(row.email || '—'),
        phone: String(row.phone || '—'),
        status,
      });
    }
  }

  const teachers = (teachersRaw ?? [])
    .map((t: Record<string, unknown>) => {
      const profile = relationOne(t.profiles as never) as {
        full_name?: string;
        email?: string;
        status?: string;
      } | null;
      const tc = relationOne(t.teacher_courses as never) as {
        gender_scope?: string | null;
        courses?: { name?: string } | { name?: string }[] | null;
      } | null;
      const course = relationOne(tc?.courses as never) as { name?: string } | null;
      return {
        id: String(t.id),
        profileId: String(t.profile_id),
        name: profile?.full_name || 'Teacher',
        email: profile?.email || '—',
        status: profile?.status || '—',
        course: course?.name || '—',
        scope: tc?.gender_scope || 'Not set',
      };
    })
    .filter((t) => !t.status || t.status === 'Approved');

  const studentsByTeacher: Record<string, number> = {};
  for (const t of teachers) studentsByTeacher[t.id] = 0;
  for (const b of batchesRaw ?? []) {
    const tid = (b as { teacher_id?: string | null }).teacher_id;
    if (!tid) continue;
    const match = teachers.find((t) => t.id === tid || t.profileId === tid);
    if (!match) continue;
    const count = approvedStudents.filter(
      (s) => s.batchId === (b as { id: string }).id,
    ).length;
    studentsByTeacher[match.id] = (studentsByTeacher[match.id] || 0) + count;
  }

  const assignmentIds = (monthAssignments ?? []).map((a) => a.id);
  let monthSubs: { assignment_id: string; marks: number | null }[] = [];
  if (assignmentIds.length > 0) {
    const { data } = await supabase
      .from('submissions')
      .select('assignment_id, marks')
      .in('assignment_id', assignmentIds);
    monthSubs = data ?? [];
  }
  const monthGraded = monthSubs.filter((s) => s.marks != null).length;
  const monthPending = monthSubs.filter((s) => s.marks == null).length;
  const attPresent = (monthAttendance ?? []).filter(
    (a) => a.status === 'Present' || a.status === 'Late',
  ).length;
  const attAbsent = (monthAttendance ?? []).filter((a) => a.status === 'Absent').length;
  const attDays = new Set((monthAttendance ?? []).map((a) => String(a.attendance_date))).size;

  const paidAll = (feePayments ?? []) as Array<{
    payment_type: string;
    year: number | null;
    month: number | null;
    amount: number;
  }>;
  const monthlyCollected = paidAll
    .filter((p) => p.payment_type === 'Monthly' && p.year === y && p.month === m)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const initialCollected = paidAll
    .filter((p) => p.payment_type === 'Initial')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const adjustmentCollected = paidAll
    .filter((p) => p.payment_type === 'Adjustment')
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const monthExpected = approvedStudents
    .filter((s) => !s.isFree)
    .reduce((s, st) => s + st.monthlyFee, 0);
  const feeGap = Math.max(0, monthExpected - monthlyCollected);

  const teacherMonthRows = teachers.map((t) => {
    const created = (monthAssignments ?? []).filter(
      (a) => a.teacher_id === t.id || a.teacher_id === t.profileId,
    );
    const ids = new Set(created.map((a) => a.id));
    const subs = monthSubs.filter((s) => ids.has(s.assignment_id));
    const checked = subs.filter((s) => s.marks != null).length;
    const att = (monthAttendance ?? []).filter((a) => a.teacher_id === t.id);
    const days = new Set(att.map((a) => String(a.attendance_date))).size;
    return {
      name: t.name,
      email: t.email,
      course: t.course,
      scope: t.scope,
      students: studentsByTeacher[t.id] || 0,
      assignments: created.length,
      submissions: subs.length,
      checked,
      pending: Math.max(0, subs.length - checked),
      attDays: days,
    };
  });

  // Optional staff pay
  let staffPayRows: Array<{
    name: string;
    kind: string;
    job: string;
    phone: string;
    email: string;
    amount: number;
    status: string;
    paidAt: string;
  }> = [];
  let staffPaidAmt = 0;
  let staffPendingAmt = 0;

  if (opts.includeStaffPay) {
    const [{ data: staffMembers }, { data: staffPays }, { data: teacherAdminProfiles }] =
      await Promise.all([
        supabase
          .from('staff_members')
          .select('id, full_name, phone, job_title, monthly_salary, is_active')
          .eq('is_active', true),
        supabase
          .from('staff_monthly_pay')
          .select('profile_id, staff_member_id, year, month, amount, status, paid_at')
          .eq('year', y)
          .eq('month', m),
        supabase
          .from('profiles')
          .select('id, full_name, email, phone, roles!inner(name)')
          .in('roles.name', ['Teacher', 'Admin']),
      ]);

    const payByProfile = new Map<string, { amount: number; status: string; paid_at: string | null }>();
    const payByStaff = new Map<string, { amount: number; status: string; paid_at: string | null }>();
    for (const p of staffPays ?? []) {
      if (p.profile_id) {
        payByProfile.set(String(p.profile_id), {
          amount: Number(p.amount || 0),
          status: String(p.status || 'Pending'),
          paid_at: (p.paid_at as string | null) ?? null,
        });
      }
      if (p.staff_member_id) {
        payByStaff.set(String(p.staff_member_id), {
          amount: Number(p.amount || 0),
          status: String(p.status || 'Pending'),
          paid_at: (p.paid_at as string | null) ?? null,
        });
      }
    }

    for (const row of teacherAdminProfiles ?? []) {
      const roleRel = relationOne(row.roles as never) as { name?: string } | null;
      const kind = roleRel?.name || 'Staff';
      const pay = payByProfile.get(String(row.id));
      const amount = pay?.amount ?? 0;
      const status = pay?.status ?? 'Pending';
      staffPayRows.push({
        name: String(row.full_name || '—'),
        kind,
        job: kind,
        phone: String(row.phone || '—'),
        email: String(row.email || '—'),
        amount,
        status,
        paidAt: pay?.paid_at ? new Date(pay.paid_at).toLocaleDateString() : '—',
      });
      if (status === 'Paid') staffPaidAmt += amount;
      else staffPendingAmt += amount;
    }

    for (const row of staffMembers ?? []) {
      const pay = payByStaff.get(String(row.id));
      const amount = pay?.amount ?? Number(row.monthly_salary ?? 0);
      const status = pay?.status ?? 'Pending';
      staffPayRows.push({
        name: String(row.full_name || '—'),
        kind: 'Other',
        job: String(row.job_title || 'Staff'),
        phone: String(row.phone || '—'),
        email: '—',
        amount,
        status,
        paidAt: pay?.paid_at ? new Date(pay.paid_at).toLocaleDateString() : '—',
      });
      if (status === 'Paid') staffPaidAmt += amount;
      else staffPendingAmt += amount;
    }
  }

  const { doc, autoTable } = await createReportDoc('landscape');

  const addHeader = (title: string, subtitle = 'Full institute system report') => {
    paintReportHeader(doc, {
      title,
      subtitle,
      metaLeft: bounds.label,
      metaRight: new Date().toLocaleString(),
      theme,
    });
  };

  // Page 1 — Overview
  addHeader('Full System Report · Overview');
  let yPos = paintSummaryBar(
    doc,
    34,
    [
      `Teachers ${teachers.length}`,
      `Students ${approvedStudents.length}`,
      `Courses ${courses.length}`,
      `Batches ${batches.length}`,
      `Pending approvals ${statusCounts.Pending || 0}`,
    ],
    theme,
  );
  yPos = paintSectionTitle(doc, yPos, 'Institute snapshot');
  autoTable(doc, {
    startY: yPos + 2,
    head: [['Metric', 'Value', 'Metric', 'Value']],
    body: [
      ['Approved teachers', String(teachers.length), 'Approved students', String(approvedStudents.length)],
      ['Pending students', String(pendingStudents.length), 'Suspended students', String(suspendedStudents.length)],
      ['Courses', String(courses.length), 'Batches', String(batches.length)],
      ['Male students', String(male), 'Female students', String(female)],
      ['No course assigned', String(noCourse), 'No batch assigned', String(noBatch)],
      ['Assignments (all-time)', String(assignmentAll ?? 0), 'Submissions (all-time)', String(submissionAll ?? 0)],
      [
        'Pending grades (all-time)',
        String(pendingGradeAll ?? 0),
        'Attendance records (all-time)',
        String(attendanceAll ?? 0),
      ],
      ['Admins', String(roleCounts.Admin || 0), 'Profile pending', String(statusCounts.Pending || 0)],
    ],
    ...defaultTableStyles(theme),
    columnStyles: {
      0: { fontStyle: 'bold' },
      2: { fontStyle: 'bold' },
    },
  });

  yPos = lastTableY(doc) + 10;
  yPos = paintSectionTitle(doc, yPos, 'Users by role & status');
  autoTable(doc, {
    startY: yPos + 2,
    head: [['Role', 'Count', 'Profile status', 'Count']],
    body: (() => {
      const roles = Object.entries(roleCounts);
      const statuses = Object.entries(statusCounts);
      const max = Math.max(roles.length, statuses.length, 1);
      const rows: string[][] = [];
      for (let i = 0; i < max; i++) {
        rows.push([
          roles[i]?.[0] || '',
          roles[i] ? String(roles[i][1]) : '',
          statuses[i]?.[0] || '',
          statuses[i] ? String(statuses[i][1]) : '',
        ]);
      }
      return rows;
    })(),
    ...defaultTableStyles('slate'),
  });

  yPos = lastTableY(doc) + 10;
  yPos = paintSectionTitle(doc, yPos, `${bounds.label} — activity & fees`);
  autoTable(doc, {
    startY: yPos + 2,
    head: [['Activity', 'Value']],
    body: [
      ['Assignments created', String((monthAssignments ?? []).length)],
      ['Submissions received', String(monthSubs.length)],
      ['Submissions checked / graded', String(monthGraded)],
      ['Submissions pending grade', String(monthPending)],
      ['Unique attendance days', String(attDays)],
      ['Present / Late marks', String(attPresent)],
      ['Absent marks', String(attAbsent)],
      ['Monthly fee expected', moneyPKR(monthExpected)],
      ['Monthly fee collected', moneyPKR(monthlyCollected)],
      ['Fee collection gap', moneyPKR(feeGap)],
      ['Initial fees collected (all-time)', moneyPKR(initialCollected)],
      ['Adjustments collected (all-time)', moneyPKR(adjustmentCollected)],
    ],
    ...defaultTableStyles('emerald'),
    columnStyles: { 0: { cellWidth: 90, fontStyle: 'bold' } },
  });

  // Page 2 — Courses & Batches
  doc.addPage();
  addHeader('Full System Report · Courses & Batches');
  yPos = paintSectionTitle(doc, 34, 'Course enrollment');
  autoTable(doc, {
    startY: yPos + 2,
    head: [['#', 'Course', 'Students', 'Male', 'Female', 'Initial', 'Monthly', 'Type']],
    body: courseEnrollment.map((c, i) => [
      String(i + 1),
      c.name,
      String(c.students),
      String(c.male),
      String(c.female),
      c.free ? 'Free' : moneyPKR(c.initial),
      c.free ? 'Free' : moneyPKR(c.monthly),
      c.free ? 'Free' : 'Paid',
    ]),
    ...defaultTableStyles('indigo'),
  });

  yPos = lastTableY(doc) + 10;
  yPos = paintSectionTitle(doc, yPos, 'Batches');
  autoTable(doc, {
    startY: yPos + 2,
    head: [['#', 'Batch', 'Course', 'Students', 'Teacher linked']],
    body: batches
      .sort((a, b) => b.students - a.students)
      .map((b, i) => [
        String(i + 1),
        b.name,
        b.course,
        String(b.students),
        b.hasTeacher ? 'Yes' : 'No',
      ]),
    ...defaultTableStyles('emerald'),
  });

  // Page 3 — Teachers
  doc.addPage();
  addHeader(`Full System Report · Teachers (${bounds.label})`);
  yPos = paintSectionTitle(doc, 34, 'Teacher progress this month');
  autoTable(doc, {
    startY: yPos + 2,
    head: [
      ['#', 'Teacher', 'Email', 'Course', 'Scope', 'Students', 'Assign.', 'Submit', 'Checked', 'Pending', 'Att. days'],
    ],
    body: teacherMonthRows
      .sort((a, b) => b.assignments - a.assignments || b.students - a.students)
      .map((r, i) => [
        String(i + 1),
        r.name,
        r.email,
        r.course,
        r.scope,
        String(r.students),
        String(r.assignments),
        String(r.submissions),
        String(r.checked),
        String(r.pending),
        String(r.attDays),
      ]),
    ...defaultTableStyles(theme),
    styles: { ...defaultTableStyles(theme).styles, fontSize: 7 },
  });

  yPos = lastTableY(doc) + 10;
  if (yPos > 155) {
    doc.addPage();
    addHeader('Full System Report · Directories');
    yPos = 34;
  }
  yPos = paintSectionTitle(doc, yPos, 'Approved teachers directory');
  autoTable(doc, {
    startY: yPos + 2,
    head: [['#', 'Teacher', 'Email', 'Course', 'Scope']],
    body: teachers.map((t, i) => [String(i + 1), t.name, t.email, t.course, t.scope]),
    ...defaultTableStyles('slate'),
  });

  if (admins.length > 0) {
    yPos = lastTableY(doc) + 10;
    if (yPos > 160) {
      doc.addPage();
      addHeader('Full System Report · Admins');
      yPos = 34;
    }
    yPos = paintSectionTitle(doc, yPos, 'Admins');
    autoTable(doc, {
      startY: yPos + 2,
      head: [['#', 'Name', 'Email', 'Phone', 'Status']],
      body: admins.map((a, i) => [String(i + 1), a.name, a.email, a.phone, a.status]),
      ...defaultTableStyles('indigo'),
    });
  }

  // Staff pay page (Super Admin)
  if (opts.includeStaffPay && staffPayRows.length > 0) {
    doc.addPage();
    addHeader('Full System Report · Staff Payroll', `${bounds.label} paid & pending`);
    paintSummaryBar(
      doc,
      34,
      [
        `Staff ${staffPayRows.length}`,
        `Paid ${moneyPKR(staffPaidAmt)}`,
        `Pending ${moneyPKR(staffPendingAmt)}`,
        `Total ${moneyPKR(staffPaidAmt + staffPendingAmt)}`,
      ],
      'indigo',
    );
    autoTable(doc, {
      startY: 52,
      head: [['#', 'Name', 'Kind', 'Job', 'Phone', 'Email', 'Amount', 'Status', 'Paid at']],
      body: staffPayRows.map((r, i) => [
        String(i + 1),
        r.name,
        r.kind,
        r.job,
        r.phone,
        r.email,
        moneyPKR(r.amount),
        r.status,
        r.paidAt,
      ]),
      ...defaultTableStyles('indigo'),
      styles: { ...defaultTableStyles('indigo').styles, fontSize: 7 },
    });
  }

  // Attention lists
  doc.addPage();
  addHeader('Full System Report · Attention lists');
  yPos = paintSectionTitle(doc, 34, 'Pending student approvals');
  autoTable(doc, {
    startY: yPos + 2,
    head: [['#', 'Name', 'Email', 'Phone', 'App ID', 'Course']],
    body: pendingStudents.slice(0, 50).map((s, i) => [
      String(i + 1),
      s.name,
      s.email,
      s.phone,
      s.applicationId || '—',
      s.courseName,
    ]),
    ...defaultTableStyles('indigo'),
  });

  yPos = lastTableY(doc) + 10;
  const attention = approvedStudents.filter((s) => !s.courseId || !s.batchId).slice(0, 60);
  yPos = paintSectionTitle(doc, yPos, 'Approved students missing course or batch');
  autoTable(doc, {
    startY: yPos + 2,
    head: [['#', 'Name', 'Email', 'App ID', 'Course', 'Batch']],
    body: attention.map((s, i) => [
      String(i + 1),
      s.name,
      s.email,
      s.applicationId || '—',
      s.courseId ? s.courseName : 'Missing',
      s.batchId ? 'Assigned' : 'Missing',
    ]),
    ...defaultTableStyles(theme),
  });

  paintFooters(doc, opts.footerNote ?? 'BanoQabil LMS · System Report');
  const prefix = opts.filePrefix ?? 'banoqabil-system-report';
  doc.save(`${prefix}-${opts.monthValue}.pdf`);
}

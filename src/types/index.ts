// Shared TypeScript types for BanoQabil

export type UserStatus = 'Pending' | 'Approved' | 'Rejected' | 'Suspended';
export type UserRole = 'Super Admin' | 'Admin' | 'Teacher' | 'Student';
export type AssignmentStatus = 'Open' | 'Closed';
export type SubmissionStatus = 'Pending' | 'Submitted' | 'Late' | 'Graded';
export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

export interface Role {
  id: string;
  name: UserRole;
  created_at: string;
}

export interface Profile {
  id: string;
  role_id: string | null;
  status: UserStatus;
  full_name: string;
  email: string;
  phone: string | null;
  address: string | null;
  avatar_url: string | null;
  permissions: AdminPermissions | null;
  created_at: string;
  updated_at: string;
  roles?: Role;
}

export interface AdminPermissions {
  can_approve_users?: boolean;
  can_manage_teachers?: boolean;
  can_manage_students?: boolean;
  can_manage_courses?: boolean;
  can_assign_teachers?: boolean;
  can_view_reports?: boolean;
  can_export_pdf?: boolean;
  can_reset_passwords?: boolean;
  can_view_submissions?: boolean;
}

export interface Course {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  batches?: Batch[];
}

export interface Batch {
  id: string;
  course_id: string;
  name: string;
  timing: string | null;
  teacher_id: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  courses?: Course;
  profiles?: Profile;
  students?: Student[];
}

export interface Teacher {
  id: string;
  profile_id: string;
  specialization: string | null;
  profiles?: Profile;
}

export interface Student {
  id: string;
  profile_id: string;
  batch_id: string | null;
  father_name: string | null;
  application_id: string | null;
  enrollment_date: string | null;
  profiles?: Profile;
  batches?: Batch;
}

export interface Assignment {
  id: string;
  batch_id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  due_date: string;
  status: AssignmentStatus;
  pdf_url: string | null;
  created_at: string;
  batches?: Batch;
  profiles?: Profile;
  assignment_submissions?: Submission[];
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  youtube_url: string | null;
  drive_url: string | null;
  status: SubmissionStatus;
  marks: number | null;
  remarks: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  assignments?: Assignment;
  students?: Student;
}

export interface DashboardStats {
  totalTeachers: number;
  totalStudents: number;
  totalCourses: number;
  pendingApprovals: number;
  totalAssignments: number;
  totalSubmissions: number;
  gradedSubmissions: number;
}

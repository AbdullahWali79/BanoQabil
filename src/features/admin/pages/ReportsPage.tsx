import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileDown, Calendar as CalendarIcon } from 'lucide-react';
// Run: npm install jspdf jspdf-autotable

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Dynamic import to avoid SSR issues if ever used in Next.js, and fails gracefully if not installed
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(40, 40, 40);
      doc.text('BanoQabil Educational Institute', 14, 22);
      
      doc.setFontSize(14);
      doc.setTextColor(100, 100, 100);
      doc.text('Weekly Performance Report', 14, 30);
      
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 36);

      // Dummy Data
      const head = [['Teacher', 'Assignments', 'Submissions', 'Pending']];
      const data = [
        ['Ali Khan', '4', '112', '14'],
        ['Sarah Ahmed', '2', '85', '5'],
        ['Usman Raza', '3', '90', '10'],
      ];

      autoTable(doc, {
        startY: 45,
        head: head,
        body: data,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] }
      });

      doc.save('banoqabil-weekly-report.pdf');
    } catch (error) {
      console.error('jsPDF not installed or error generating PDF. Falling back to print.', error);
      window.print();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Generate and export performance reports</p>
        </div>
        <Button onClick={handleExport} disabled={loading} className="gap-2">
          {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <FileDown className="w-4 h-4" />}
          Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Filter Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date Range</label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2 border rounded-md text-sm flex items-center gap-2 text-slate-500 bg-slate-50 dark:bg-slate-900/50">
                  <CalendarIcon className="w-4 h-4" /> From
                </div>
                <div className="flex-1 px-3 py-2 border rounded-md text-sm flex items-center gap-2 text-slate-500 bg-slate-50 dark:bg-slate-900/50">
                  <CalendarIcon className="w-4 h-4" /> To
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Teacher</label>
              <select className="w-full px-3 py-2 border rounded-md text-sm bg-transparent">
                <option>All Teachers</option>
                <option>Ali Khan</option>
                <option>Sarah Ahmed</option>
              </select>
            </div>
            <Button className="w-full mt-2" variant="secondary">Generate Report</Button>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Report Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/50 font-medium border-b">
                  <tr>
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3">Assignments Created</th>
                    <th className="px-4 py-3">Submissions Received</th>
                    <th className="px-4 py-3">Pending Grading</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3">Ali Khan</td>
                    <td className="px-4 py-3">4</td>
                    <td className="px-4 py-3">112</td>
                    <td className="px-4 py-3">14</td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3">Sarah Ahmed</td>
                    <td className="px-4 py-3">2</td>
                    <td className="px-4 py-3">85</td>
                    <td className="px-4 py-3">5</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

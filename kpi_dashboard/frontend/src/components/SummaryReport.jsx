import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { FileText, Download } from 'lucide-react'
import apiClient from '@/lib/apiClient.js'

const SummaryReport = () => {
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true)
        // 우선 순위: 백엔드 수신 분석 최신 → 없으면 기존 mock 리포트
        try {
          const latest = await apiClient.get('/api/analysis-result/latest')
          const latestReport = latest.data
          const synthetic = {
            id: latestReport.id,
            title: `LLM 종합 분석 리포트 #${latestReport.id}`,
            content: (latestReport.analysis?.executive_summary || latestReport.analysis?.overall_summary || '요약 없음'),
            generated_at: latestReport.created_at,
            _raw: latestReport,
          }
          setReports([synthetic])
          setSelectedReport(synthetic)
        } catch (_) {
          const response = await apiClient.get('/api/reports/summary')
          setReports(response.data.reports || [])
          if (response.data.reports && response.data.reports.length > 0) {
            setSelectedReport(response.data.reports[0])
          }
        }
      } catch (error) {
        console.error('Error fetching reports:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchReports()
  }, [])

  const formatContent = (content) => {
    return content.split('\n').map((line, index) => {
      if (line.startsWith('# ')) {
        return <h1 key={index} className="text-2xl font-bold mb-4 mt-6">{line.substring(2)}</h1>
      } else if (line.startsWith('## ')) {
        return <h2 key={index} className="text-xl font-semibold mb-3 mt-5">{line.substring(3)}</h2>
      } else if (line.startsWith('### ')) {
        return <h3 key={index} className="text-lg font-medium mb-2 mt-4">{line.substring(4)}</h3>
      } else if (line.startsWith('- ')) {
        return <li key={index} className="ml-4 mb-1">{line.substring(2)}</li>
      } else if (line.trim() === '') {
        return <br key={index} />
      } else {
        return <p key={index} className="mb-2">{line}</p>
      }
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold">Summary Report</h2>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500">Loading reports...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Summary Report</h2>
        {selectedReport && (
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => {
              try {
                const name = (selectedReport.title || 'report').replace(/\s+/g,'_')
                const content = String(selectedReport.content || '')
                const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${name}.md`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              } catch (e) {
                console.error('Export failed', e)
              }
            }}
          >
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Report List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Available Reports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reports.map((report) => (
                  <Button
                    key={report.id}
                    variant={selectedReport?.id === report.id ? "default" : "ghost"}
                    className="w-full justify-start text-left"
                    onClick={() => setSelectedReport(report)}
                  >
                    <div className="truncate">
                      <div className="font-medium">{report.title}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(report.generated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Report Content */}
        <div className="lg:col-span-3">
          {selectedReport ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedReport.title}</CardTitle>
                <p className="text-sm text-gray-500">
                  Generated on {new Date(selectedReport.generated_at).toLocaleString()}
                </p>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  {formatContent(selectedReport.content)}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500">
                  Select a report to view its content
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default SummaryReport


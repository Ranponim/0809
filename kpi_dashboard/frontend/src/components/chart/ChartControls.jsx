import React, { memo } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Checkbox } from '@/components/ui/checkbox.jsx'
import { TrendingUp } from 'lucide-react'

const ChartControls = memo(({
  chartConfig,
  onConfigChange,
  kpiOptions,
  loading,
  onGenerate,
  useDbPegs,
  onToggleDbPegs,
  pegOptionsLoading,
  dbPegOptions
}) => {
  const handleInputChange = (field, value) => {
    onConfigChange(prev => ({ ...prev, [field]: value }))
  }

  const loadFromPreference = () => {
    try {
      const raw = localStorage.getItem('activePreference')
      if (!raw) return
      const pref = JSON.parse(raw)
      const defNEs = Array.isArray(pref?.config?.defaultNEs) ? pref.config.defaultNEs.map(String) : []
      const defCellIDs = Array.isArray(pref?.config?.defaultCellIDs) ? pref.config.defaultCellIDs.map(String) : []
      onConfigChange(prev => ({
        ...prev,
        ne: defNEs.join(','),
        cellid: defCellIDs.join(','),
      }))
    } catch {}
  }

  const getCurrentKpiOptions = () => {
    if (useDbPegs && dbPegOptions.length > 0) {
      return dbPegOptions
    }
    return kpiOptions
  }

  return (
    <div>
      {/* DB PEG 옵션 토글 */}
      <div className="mb-4 p-4 border rounded-lg bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">PEG 데이터 소스</Label>
            <p className="text-xs text-muted-foreground">
              {useDbPegs ? 'Database에서 실제 PEG 목록을 사용합니다' : '기본 KPI 목록을 사용합니다'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={useDbPegs ? "secondary" : "default"}
              size="sm"
              onClick={() => onToggleDbPegs(false)}
            >
              기본 KPI
            </Button>
            <Button
              variant={useDbPegs ? "default" : "secondary"}
              size="sm"
              onClick={() => onToggleDbPegs(true)}
              disabled={pegOptionsLoading}
            >
              {pegOptionsLoading ? '로딩 중...' : 'DB PEG'}
            </Button>
          </div>
        </div>
        {useDbPegs && dbPegOptions.length === 0 && !pegOptionsLoading && (
          <p className="text-xs text-amber-600 mt-2">
            ⚠️ DB PEG를 불러올 수 없습니다. Database Settings를 확인하세요.
          </p>
        )}
        {useDbPegs && dbPegOptions.length > 0 && (
          <p className="text-xs text-green-600 mt-2">
            ✅ {dbPegOptions.length}개의 DB PEG를 사용할 수 있습니다
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Primary KPI */}
        <div className="space-y-2">
          <Label>Primary KPI</Label>
          <Select 
            value={chartConfig.primaryKPI} 
            onValueChange={(value) => handleInputChange('primaryKPI', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getCurrentKpiOptions().map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Secondary KPI */}
        <div className="space-y-2">
          <Label>Secondary KPI (Dual Axis)</Label>
          <Select 
            value={chartConfig.secondaryKPI} 
            onValueChange={(value) => handleInputChange('secondaryKPI', value)}
            disabled={!chartConfig.showSecondaryAxis}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getCurrentKpiOptions().map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Period 1 Dates */}
        <div className="space-y-2">
          <Label>Period 1 Start</Label>
          <Input
            type="date"
            value={chartConfig.startDate1}
            onChange={(e) => handleInputChange('startDate1', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Period 1 End</Label>
          <Input
            type="date"
            value={chartConfig.endDate1}
            onChange={(e) => handleInputChange('endDate1', e.target.value)}
          />
        </div>

        {/* Period 2 Dates */}
        <div className="space-y-2">
          <Label>Period 2 Start</Label>
          <Input
            type="date"
            value={chartConfig.startDate2}
            onChange={(e) => handleInputChange('startDate2', e.target.value)}
            disabled={!chartConfig.showComparison}
          />
        </div>

        <div className="space-y-2">
          <Label>Period 2 End</Label>
          <Input
            type="date"
            value={chartConfig.endDate2}
            onChange={(e) => handleInputChange('endDate2', e.target.value)}
            disabled={!chartConfig.showComparison}
          />
        </div>

        {/* Filters: NE / Cell ID */}
        <div className="space-y-2">
          <Label>NE</Label>
          <Input
            placeholder="e.g., nvgnb#10000 or nvgnb#10000,nvgnb#20000"
            value={chartConfig.ne}
            onChange={(e)=> handleInputChange('ne', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Cell ID</Label>
          <Input
            placeholder="e.g., 2010 or 2010,2011"
            value={chartConfig.cellid}
            onChange={(e)=> handleInputChange('cellid', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Use Preference (NE/Cell)</Label>
          <Button
            type="button"
            variant="outline"
            onClick={loadFromPreference}
          >
            Load from Preference
          </Button>
        </div>
      </div>

      {/* Options */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="showComparison"
            checked={chartConfig.showComparison}
            onCheckedChange={(checked) => handleInputChange('showComparison', checked)}
          />
          <Label htmlFor="showComparison">Show Period Comparison</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showSecondaryAxis"
            checked={chartConfig.showSecondaryAxis}
            onCheckedChange={(checked) => handleInputChange('showSecondaryAxis', checked)}
          />
          <Label htmlFor="showSecondaryAxis">Show Secondary Y-Axis</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="showThreshold"
            checked={chartConfig.showThreshold}
            onCheckedChange={(checked) => handleInputChange('showThreshold', checked)}
          />
          <Label htmlFor="showThreshold">Show Threshold Line</Label>
        </div>

        {chartConfig.showThreshold && (
          <div className="flex items-center space-x-2">
            <Label htmlFor="threshold">Threshold Value:</Label>
            <Input
              id="threshold"
              type="number"
              step="0.1"
              value={chartConfig.thresholdValue}
              onChange={(e) => handleInputChange('thresholdValue', parseFloat(e.target.value))}
              className="w-24"
            />
          </div>
        )}
      </div>

      <div className="mt-4">
        <Button onClick={onGenerate} disabled={loading} className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          {loading ? 'Generating...' : 'Generate Chart'}
        </Button>
      </div>
    </div>
  )
})

ChartControls.displayName = 'ChartControls'

export default ChartControls

/**
 * DashboardSettings 컴포넌트
 * 
 * Dashboard의 설정 부분을 담당하는 컴포넌트입니다.
 * 기본 시간 설정, Time1/Time2 비교 설정 등을 포함합니다.
 * 
 * Props:
 * - defaultTimeRange: 기본 시간 범위
 * - enableTimeComparison: Time1/Time2 비교 모드 활성화 여부
 * - tempTimeSettings: 임시 시간 설정
 * - inputCompleted: 입력 완료 상태
 * - loading: 로딩 상태
 * - onUpdateDefaultTimeRange: 기본 시간 범위 업데이트 핸들러
 * - onUpdateEnableTimeComparison: Time1/Time2 비교 모드 업데이트 핸들러
 * - onUpdateTempTimeSetting: 임시 시간 설정 업데이트 핸들러
 * - onApplyTime1Settings: Time1 설정 적용 핸들러
 * - onApplyTime2Settings: Time2 설정 적용 핸들러
 * - onToggleTime1Settings: Time1 설정 토글 핸들러
 * - onToggleTime2Settings: Time2 설정 토글 핸들러
 * - onManualRefresh: 수동 새로고침 핸들러
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Switch } from '@/components/ui/switch.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Calendar, Check, X } from 'lucide-react'

// 로깅 유틸리티
const logDashboardSettings = (level, message, data = null) => {
  const timestamp = new Date().toISOString()
  const prefix = `[DashboardSettings:${timestamp}]`
  
  switch (level) {
    case 'info':
      console.log(`${prefix} ${message}`, data)
      break
    case 'error':
      console.error(`${prefix} ${message}`, data)
      break
    case 'warn':
      console.warn(`${prefix} ${message}`, data)
      break
    case 'debug':
      console.debug(`${prefix} ${message}`, data)
      break
    default:
      console.log(`${prefix} ${message}`, data)
  }
}

const DashboardSettings = ({
  defaultTimeRange,
  enableTimeComparison,
  tempTimeSettings,
  inputCompleted,
  loading,
  onUpdateDefaultTimeRange,
  onUpdateEnableTimeComparison,
  onUpdateTempTimeSetting,
  onApplyTime1Settings,
  onApplyTime2Settings,
  onToggleTime1Settings,
  onToggleTime2Settings,
  onManualRefresh
}) => {
  logDashboardSettings('debug', 'DashboardSettings 렌더링', {
    defaultTimeRange,
    enableTimeComparison,
    tempTimeSettings,
    inputCompleted,
    onToggleTime1Settings: !!onToggleTime1Settings,
    onToggleTime2Settings: !!onToggleTime2Settings,
    loading
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          기본시간 설정
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 기본 시간 범위 */}
        <div>
          <Label htmlFor="defaultTimeRange" className="text-sm font-medium">
            기본 시간 범위
          </Label>
          <Select value={defaultTimeRange.toString()} onValueChange={onUpdateDefaultTimeRange}>
            <SelectTrigger>
              <SelectValue placeholder="시간 범위 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5분</SelectItem>
              <SelectItem value="15">15분</SelectItem>
              <SelectItem value="30">30분</SelectItem>
              <SelectItem value="60">1시간</SelectItem>
              <SelectItem value="120">2시간</SelectItem>
              <SelectItem value="360">6시간</SelectItem>
              <SelectItem value="720">12시간</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time1/Time2 비교 설정 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="enableTimeComparison"
              checked={enableTimeComparison}
              onCheckedChange={onUpdateEnableTimeComparison}
            />
            <Label htmlFor="enableTimeComparison" className="text-sm font-medium">
              Time1/Time2 비교 활성화
            </Label>
          </div>

          {enableTimeComparison && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-6">
                {/* Time1 설정 */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-blue-600">Time1 설정</h4>
                  <div className="space-y-2">
                    {/* Time1 시작 시간 설정 */}
                    <div>
                      <Label className="text-xs text-muted-foreground">시작 시간</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="time1StartDate" className="text-xs">날짜</Label>
                          <input
                            type="date"
                            id="time1StartDate"
                            className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs"
                            value={tempTimeSettings.time1Start ? tempTimeSettings.time1Start.split('T')[0] : ''}
                            onChange={(e) => {
                              const currentTime = tempTimeSettings.time1Start ? tempTimeSettings.time1Start.split('T')[1] : '00:00';
                              onUpdateTempTimeSetting('time1', 'Start', `${e.target.value}T${currentTime}`);
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="time1StartHour" className="text-xs">시간</Label>
                          <Select
                            value={tempTimeSettings.time1Start ? tempTimeSettings.time1Start.split('T')[1]?.split(':')[0] || '00' : '00'}
                            onValueChange={(hour) => {
                              const currentDate = tempTimeSettings.time1Start ? tempTimeSettings.time1Start.split('T')[0] : new Date().toISOString().split('T')[0];
                              const currentMinute = tempTimeSettings.time1Start ? tempTimeSettings.time1Start.split('T')[1]?.split(':')[1] || '00' : '00';
                              onUpdateTempTimeSetting('time1', 'Start', `${currentDate}T${hour}:${currentMinute}`);
                            }}
                          >
                            <SelectTrigger className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({length: 24}, (_, i) => (
                                <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                                  {i.toString().padStart(2, '0')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="time1StartMinute" className="text-xs">분</Label>
                          <Select
                            value={tempTimeSettings.time1Start ? tempTimeSettings.time1Start.split('T')[1]?.split(':')[1] || '00' : '00'}
                            onValueChange={(minute) => {
                              const currentDate = tempTimeSettings.time1Start ? tempTimeSettings.time1Start.split('T')[0] : new Date().toISOString().split('T')[0];
                              const currentHour = tempTimeSettings.time1Start ? tempTimeSettings.time1Start.split('T')[1]?.split(':')[0] || '00' : '00';
                              onUpdateTempTimeSetting('time1', 'Start', `${currentDate}T${currentHour}:${minute}`);
                            }}
                          >
                            <SelectTrigger className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="00">00</SelectItem>
                              <SelectItem value="15">15</SelectItem>
                              <SelectItem value="30">30</SelectItem>
                              <SelectItem value="45">45</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Time1 끝 시간 설정 */}
                    <div>
                      <Label className="text-xs text-muted-foreground">끝 시간</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="time1EndDate" className="text-xs">날짜</Label>
                          <input
                            type="date"
                            id="time1EndDate"
                            className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs"
                            value={tempTimeSettings.time1End ? tempTimeSettings.time1End.split('T')[0] : ''}
                            onChange={(e) => {
                              const currentTime = tempTimeSettings.time1End ? tempTimeSettings.time1End.split('T')[1] : '00:00';
                              onUpdateTempTimeSetting('time1', 'End', `${e.target.value}T${currentTime}`);
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="time1EndHour" className="text-xs">시간</Label>
                          <Select
                            value={tempTimeSettings.time1End ? tempTimeSettings.time1End.split('T')[1]?.split(':')[0] || '00' : '00'}
                            onValueChange={(hour) => {
                              const currentDate = tempTimeSettings.time1End ? tempTimeSettings.time1End.split('T')[0] : new Date().toISOString().split('T')[0];
                              const currentMinute = tempTimeSettings.time1End ? tempTimeSettings.time1End.split('T')[1]?.split(':')[1] || '00' : '00';
                              onUpdateTempTimeSetting('time1', 'End', `${currentDate}T${hour}:${currentMinute}`);
                            }}
                          >
                            <SelectTrigger className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({length: 24}, (_, i) => (
                                <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                                  {i.toString().padStart(2, '0')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="time1EndMinute" className="text-xs">분</Label>
                          <Select
                            value={tempTimeSettings.time1End ? tempTimeSettings.time1End.split('T')[1]?.split(':')[1] || '00' : '00'}
                            onValueChange={(minute) => {
                              const currentDate = tempTimeSettings.time1End ? tempTimeSettings.time1End.split('T')[0] : new Date().toISOString().split('T')[0];
                              const currentHour = tempTimeSettings.time1End ? tempTimeSettings.time1End.split('T')[1]?.split(':')[0] || '00' : '00';
                              onUpdateTempTimeSetting('time1', 'End', `${currentDate}T${currentHour}:${minute}`);
                            }}
                          >
                            <SelectTrigger className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="00">00</SelectItem>
                              <SelectItem value="15">15</SelectItem>
                              <SelectItem value="30">30</SelectItem>
                              <SelectItem value="45">45</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={onApplyTime1Settings}
                      disabled={!tempTimeSettings.time1Start || !tempTimeSettings.time1End || inputCompleted.time1}
                      size="sm"
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {inputCompleted.time1 ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Time1 설정 완료
                        </>
                      ) : (
                        'Time1 설정 입력'
                      )}
                    </Button>
                  </div>
                </div>

                {/* Time2 설정 */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-green-600">Time2 설정</h4>
                  <div className="space-y-2">
                    {/* Time2 시작 시간 설정 */}
                    <div>
                      <Label className="text-xs text-muted-foreground">시작 시간</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="time2StartDate" className="text-xs">날짜</Label>
                          <input
                            type="date"
                            id="time2StartDate"
                            className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs"
                            value={tempTimeSettings.time2Start ? tempTimeSettings.time2Start.split('T')[0] : ''}
                            onChange={(e) => {
                              const currentTime = tempTimeSettings.time2Start ? tempTimeSettings.time2Start.split('T')[1] : '00:00';
                              onUpdateTempTimeSetting('time2', 'Start', `${e.target.value}T${currentTime}`);
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="time2StartHour" className="text-xs">시간</Label>
                          <Select
                            value={tempTimeSettings.time2Start ? tempTimeSettings.time2Start.split('T')[1]?.split(':')[0] || '00' : '00'}
                            onValueChange={(hour) => {
                              const currentDate = tempTimeSettings.time2Start ? tempTimeSettings.time2Start.split('T')[0] : new Date().toISOString().split('T')[0];
                              const currentMinute = tempTimeSettings.time2Start ? tempTimeSettings.time2Start.split('T')[1]?.split(':')[1] || '00' : '00';
                              onUpdateTempTimeSetting('time2', 'Start', `${currentDate}T${hour}:${currentMinute}`);
                            }}
                          >
                            <SelectTrigger className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({length: 24}, (_, i) => (
                                <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                                  {i.toString().padStart(2, '0')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="time2StartMinute" className="text-xs">분</Label>
                          <Select
                            value={tempTimeSettings.time2Start ? tempTimeSettings.time2Start.split('T')[1]?.split(':')[1] || '00' : '00'}
                            onValueChange={(minute) => {
                              const currentDate = tempTimeSettings.time2Start ? tempTimeSettings.time2Start.split('T')[0] : new Date().toISOString().split('T')[0];
                              const currentHour = tempTimeSettings.time2Start ? tempTimeSettings.time2Start.split('T')[1]?.split(':')[0] || '00' : '00';
                              onUpdateTempTimeSetting('time2', 'Start', `${currentDate}T${currentHour}:${minute}`);
                            }}
                          >
                            <SelectTrigger className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="00">00</SelectItem>
                              <SelectItem value="15">15</SelectItem>
                              <SelectItem value="30">30</SelectItem>
                              <SelectItem value="45">45</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Time2 끝 시간 설정 */}
                    <div>
                      <Label className="text-xs text-muted-foreground">끝 시간</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label htmlFor="time2EndDate" className="text-xs">날짜</Label>
                          <input
                            type="date"
                            id="time2EndDate"
                            className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs"
                            value={tempTimeSettings.time2End ? tempTimeSettings.time2End.split('T')[0] : ''}
                            onChange={(e) => {
                              const currentTime = tempTimeSettings.time2End ? tempTimeSettings.time2End.split('T')[1] : '00:00';
                              onUpdateTempTimeSetting('time2', 'End', `${e.target.value}T${currentTime}`);
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor="time2EndHour" className="text-xs">시간</Label>
                          <Select
                            value={tempTimeSettings.time2End ? tempTimeSettings.time2End.split('T')[1]?.split(':')[0] || '00' : '00'}
                            onValueChange={(hour) => {
                              const currentDate = tempTimeSettings.time2End ? tempTimeSettings.time2End.split('T')[0] : new Date().toISOString().split('T')[0];
                              const currentMinute = tempTimeSettings.time2End ? tempTimeSettings.time2End.split('T')[1]?.split(':')[1] || '00' : '00';
                              onUpdateTempTimeSetting('time2', 'End', `${currentDate}T${hour}:${currentMinute}`);
                            }}
                          >
                            <SelectTrigger className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({length: 24}, (_, i) => (
                                <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                                  {i.toString().padStart(2, '0')}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="time2EndMinute" className="text-xs">분</Label>
                          <Select
                            value={tempTimeSettings.time2End ? tempTimeSettings.time2End.split('T')[1]?.split(':')[1] || '00' : '00'}
                            onValueChange={(minute) => {
                              const currentDate = tempTimeSettings.time2End ? tempTimeSettings.time2End.split('T')[0] : new Date().toISOString().split('T')[0];
                              const currentHour = tempTimeSettings.time2End ? tempTimeSettings.time2End.split('T')[1]?.split(':')[0] || '00' : '00';
                              onUpdateTempTimeSetting('time2', 'End', `${currentDate}T${currentHour}:${minute}`);
                            }}
                          >
                            <SelectTrigger className="w-full h-8 px-3 py-1 border border-gray-300 rounded-md text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="00">00</SelectItem>
                              <SelectItem value="15">15</SelectItem>
                              <SelectItem value="30">30</SelectItem>
                              <SelectItem value="45">45</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={onApplyTime2Settings}
                      disabled={!tempTimeSettings.time2Start || !tempTimeSettings.time2End || inputCompleted.time2}
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      {inputCompleted.time2 ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Time2 설정 완료
                        </>
                      ) : (
                        'Time2 설정 입력'
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Time1/Time2 비교 데이터 로드 버튼 */}
              <div className="flex justify-center">
                <Button 
                  onClick={onManualRefresh}
                  disabled={loading || !inputCompleted.time1 || !inputCompleted.time2}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {loading ? '데이터 로딩 중...' : 'Time1/Time2 비교 데이터 로드'}
                </Button>
              </div>

              {/* 입력 상태 표시 및 토글 버튼 */}
              <div className="flex justify-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 ${inputCompleted.time1 ? 'text-green-600' : 'text-gray-500'}`}>
                    {inputCompleted.time1 ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Time1 설정 {inputCompleted.time1 ? '완료' : '대기'}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleTime1Settings}
                    className="h-6 px-2 text-xs"
                    disabled={!onToggleTime1Settings}
                  >
                    {inputCompleted.time1 ? '수정' : '완료'}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 ${inputCompleted.time2 ? 'text-green-600' : 'text-gray-500'}`}>
                    {inputCompleted.time2 ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    Time2 설정 {inputCompleted.time2 ? '완료' : '대기'}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleTime2Settings}
                    className="h-6 px-2 text-xs"
                    disabled={!onToggleTime2Settings}
                  >
                    {inputCompleted.time2 ? '수정' : '완료'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 일반 데이터 새로고침 버튼 */}
          {!enableTimeComparison && (
            <Button 
              onClick={onManualRefresh} 
              disabled={loading}
              className="w-full"
            >
              {loading ? '데이터 로딩 중...' : '데이터 새로고침'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default DashboardSettings


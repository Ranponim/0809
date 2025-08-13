import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog.jsx'
import { Settings, Save, Upload, Download, Trash2, Plus } from 'lucide-react'
import apiClient from '@/lib/apiClient.js'
import { toast } from 'sonner'

const Preference = () => {
  const [preferences, setPreferences] = useState([])
  const [selectedPreference, setSelectedPreference] = useState(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newPreference, setNewPreference] = useState({
    name: '',
    description: '',
    config: {}
  })
  const [loading, setLoading] = useState(true)
  const [derivedEditor, setDerivedEditor] = useState('{\n  "telus_RACH_Success": "Random_access_preamble_count/Random_access_response*100"\n}')
  const [mappingEditor, setMappingEditor] = useState('{
  "availability": { "peg_like": ["Accessibility_%"] },
  "rrc": { "peg_like": ["RRC_%"] }
}')

  useEffect(() => {
    fetchPreferences()
  }, [])

  const fetchPreferences = async () => {
    try {
      setLoading(true)
      const response = await apiClient.get('/api/preferences')
      setPreferences(response.data.preferences || [])
    } catch (error) {
      console.error('Error fetching preferences:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePreference = async () => {
    try {
      const config = {
        dashboardLayout: 'grid',
        defaultKPIs: ['availability', 'rrc', 'erab'],
        defaultDateRange: 7,
        // 엔티티 기반 대신 NE/CellID 기본값을 사용
        defaultNEs: ['nvgnb#10000', 'nvgnb#20000'],
        defaultCellIDs: ['2010', '2011'],
        chartSettings: {
          showGrid: true,
          showLegend: true,
          lineWidth: 2
        }
      }

      await apiClient.post('/api/preferences', {
        ...newPreference,
        config
      })

      setNewPreference({ name: '', description: '', config: {} })
      setIsCreateDialogOpen(false)
      fetchPreferences()
    } catch (error) {
      console.error('Error creating preference:', error)
    }
  }

  const handleDeletePreference = async (id) => {
    try {
      await apiClient.delete(`/api/preferences/${id}`)
      fetchPreferences()
      if (selectedPreference?.id === id) {
        setSelectedPreference(null)
      }
    } catch (error) {
      console.error('Error deleting preference:', error)
    }
  }

  const handleExportPreference = (preference) => {
    const dataStr = JSON.stringify(preference, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `${preference.name.replace(/\s+/g, '_')}_preference.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const handleImportPreference = (event) => {
    const file = event.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const importedPreference = JSON.parse(e.target.result)
          await apiClient.post('/api/preferences', {
            name: `${importedPreference.name} (Imported)`,
            description: importedPreference.description,
            config: importedPreference.config
          })
          fetchPreferences()
        } catch (error) {
          console.error('Error importing preference:', error)
        }
      }
      reader.readAsText(file)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold">Preference</h2>
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-gray-500">Loading preferences...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Preference</h2>
        <div className="flex gap-2">
          <input
            type="file"
            accept=".json"
            onChange={handleImportPreference}
            style={{ display: 'none' }}
            id="import-file"
          />
          <Button
            variant="outline"
            onClick={() => document.getElementById('import-file').click()}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                New Preference
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Preference</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newPreference.name}
                    onChange={(e) => setNewPreference(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter preference name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newPreference.description}
                    onChange={(e) => setNewPreference(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Enter preference description"
                  />
                </div>
                <Button onClick={handleCreatePreference} className="w-full">
                  Create Preference
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Preference List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Saved Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {preferences.length === 0 ? (
                  <div className="text-center text-gray-500 py-4">
                    No preferences saved yet
                  </div>
                ) : (
                  preferences.map((preference) => (
                    <div
                      key={preference.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPreference?.id === preference.id
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedPreference(preference)}
                    >
                      <div className="font-medium">{preference.name}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {preference.description}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preference Details */}
        <div className="lg:col-span-2">
          {selectedPreference ? (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{selectedPreference.name}</CardTitle>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedPreference.description}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportPreference(selectedPreference)}
                      className="flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Export
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeletePreference(selectedPreference.id)}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Configuration</h4>
                    <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
                      {JSON.stringify(selectedPreference.config, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Options Reference</h4>
                    <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto">
{`{
  "dashboardLayout": "grid", // options: "grid", "masonry", "single"
  "defaultKPIs": ["availability", "rrc", "erab"],
  "defaultDateRange": 7,       // days. options: 1, 7, 14, 30, 90
  "defaultNEs": ["nvgnb#10000", "nvgnb#20000"],   // array of strings
  "defaultCellIDs": ["2010", "2011"],            // array of strings
  "availableKPIs": [                                 // KPI picker list
    { "value": "availability", "label": "Availability (%)", "threshold": 99.0 },
    { "value": "rrc", "label": "RRC Success Rate (%)", "threshold": 98.5 }
  ],
  "chartSettings": {
    "showGrid": true,     // boolean
    "showLegend": true,   // boolean
    "lineWidth": 2        // integer (1..4)
    // optional: "palette": "default"  // options: "default", "pastel", "vivid"
  },
  "derived_pegs": {        // optional: custom formulas, name: expression
    "telus_RACH_Success": "Random_access_preamble_count/Random_access_response*100"
  }
}`}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Derived PEGs (JSON)</h4>
                    <Textarea
                      value={derivedEditor}
                      onChange={(e)=>setDerivedEditor(e.target.value)}
                      rows={8}
                      placeholder={'{\n  "peg_name": "A/B*100"\n}'}
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        onClick={async ()=>{
                          try {
                            const parsed = JSON.parse(derivedEditor)
                            const res = await apiClient.put(`/api/preferences/${selectedPreference.id}/derived-pegs`, { derived_pegs: parsed })
                            // 로컬 상태 반영
                            setSelectedPreference(prev=> ({...prev, config: { ...(prev?.config||{}), derived_pegs: res.data.derived_pegs }}))
                          } catch (e) {
                            console.error('Invalid JSON or update failed', e)
                          }
                        }}
                      >
                        Save Derived PEGs
                      </Button>
                      <Button
                        variant="outline"
                        onClick={async ()=>{
                          try {
                            const res = await apiClient.get(`/api/preferences/${selectedPreference.id}/derived-pegs`)
                            setDerivedEditor(JSON.stringify(res.data.derived_pegs || {}, null, 2))
                          } catch(e) {
                            console.error('Fetch derived pegs failed', e)
                          }
                        }}
                      >
                        Load from Server
                      </Button>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">KPI Mappings (JSON)</h4>
                    <Textarea
                      value={mappingEditor}
                      onChange={(e)=>setMappingEditor(e.target.value)}
                      rows={8}
                      placeholder={'{\n  "availability": { "peg_names": ["Accessibility_Attempts","Accessibility_Success"] },\n  "rrc": { "peg_like": ["RRC_%"] }\n}'}
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="outline"
                        onClick={async ()=>{
                          try {
                            const parsed = JSON.parse(mappingEditor)
                            const nextCfg = { ...(selectedPreference?.config||{}), kpiMappings: parsed }
                            await apiClient.put(`/api/preferences/${selectedPreference.id}`, {
                              name: selectedPreference.name,
                              description: selectedPreference.description,
                              config: nextCfg
                            })
                            setSelectedPreference(prev => ({ ...(prev||{}), config: nextCfg }))
                            toast.success('KPI mappings saved')
                          } catch (e) {
                            console.error('Invalid JSON or save failed', e)
                            toast.error('Save failed')
                          }
                        }}
                      >
                        Save KPI Mappings
                      </Button>
                      <Button
                        variant="outline"
                        onClick={()=>{
                          try {
                            const obj = (selectedPreference?.config?.kpiMappings) || {}
                            setMappingEditor(JSON.stringify(obj, null, 2))
                          } catch(e) {
                            setMappingEditor('{}')
                          }
                        }}
                      >
                        Load from Preference
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      className="flex items-center gap-2"
                      onClick={async () => {
                        try {
                          if (!selectedPreference) return
                          await apiClient.put(`/api/preferences/${selectedPreference.id}`, {
                            name: selectedPreference.name,
                            description: selectedPreference.description,
                            config: selectedPreference.config || {}
                          })
                          toast.success('Preference saved')
                          // 목록 갱신 및 선택 유지
                          await fetchPreferences()
                          const updated = (preferences || []).find(p => p.id === selectedPreference.id)
                          if (updated) setSelectedPreference(updated)
                        } catch (e) {
                          console.error('Failed to save preference', e)
                          toast.error('Save failed')
                        }
                      }}
                    >
                      <Save className="h-4 w-4" />
                      Save Preference
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => {
                        try {
                          if (!selectedPreference) return
                          localStorage.setItem('activePreference', JSON.stringify(selectedPreference))
                          toast.success('Applied to Dashboard')
                        } catch (e) {
                          console.error('Failed to apply to dashboard', e)
                          toast.error('Apply failed')
                        }
                      }}
                    >
                      Apply to Dashboard
                    </Button>
                  </div>
                  <div className="text-xs text-gray-500">변경사항을 저장하려면 Save Preference, 대시보드에 적용하려면 Apply to Dashboard를 누르세요.</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500">
                  Select a preference to view its details
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default Preference


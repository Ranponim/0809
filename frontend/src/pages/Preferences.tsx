import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Group, NumberInput, Stack, Text, Textarea } from '@mantine/core'
import { usePreferencesStore } from '../stores/preferences'

export default function Preferences() {
  const { loading, preferences, load, save, setLocal } = usePreferencesStore()
  const [json, setJson] = useState('')
  const canSave = useMemo(() => !!preferences, [preferences])

  useEffect(() => {
    if (!preferences) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (preferences) setJson(JSON.stringify(preferences, null, 2))
  }, [preferences])

  function saveJson() {
    if (!preferences) return
    try {
      const obj = JSON.parse(json)
      save(obj)
    } catch (e) {
      // ignore invalid JSON for now
    }
  }

  return (
    <Stack>
      <Card withBorder shadow="sm" p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>User Preferences</Text>
          <Group>
            <Button variant="light" onClick={load} loading={loading}>Reload</Button>
            <Button onClick={saveJson} disabled={!canSave} loading={loading}>Save</Button>
          </Group>
        </Group>
        {!preferences && <Text size="sm" c="dimmed">No preferences loaded.</Text>}
        {preferences && (
          <Stack>
            <NumberInput
              label="Default Date Range (days)"
              value={preferences.dateRangeDays}
              onChange={(v) => setLocal((p) => ({ ...p, dateRangeDays: Number(v ?? 7) }))}
              min={1}
              max={90}
              w={240}
            />
            <Textarea
              label="Raw JSON"
              minRows={12}
              value={json}
              onChange={(e) => setJson(e.currentTarget.value)}
              autosize
            />
          </Stack>
        )}
      </Card>
    </Stack>
  )
}
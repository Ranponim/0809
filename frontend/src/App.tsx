import { AppShell, Burger, Group, ScrollArea, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { IconChartLine, IconHome, IconSettings, IconTable } from '@tabler/icons-react'
import Dashboard from './pages/Dashboard'
import Results from './pages/Results'
import StatsExplorer from './pages/StatsExplorer'
import Preferences from './pages/Preferences'

function App() {
  const [opened, { toggle }] = useDisclosure()
  const location = useLocation()

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700}>LLM Analysis Console</Text>
          </Group>
          <Text size="sm" c="dimmed">{location.pathname}</Text>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        <ScrollArea>
          <NavLink to="/" end style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <Group gap="xs" py={8} c={isActive ? 'blue' : undefined}>
                <IconHome size={18} />
                <Text>Dashboard</Text>
              </Group>
            )}
          </NavLink>
          <NavLink to="/results" style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <Group gap="xs" py={8} c={isActive ? 'blue' : undefined}>
                <IconTable size={18} />
                <Text>Results</Text>
              </Group>
            )}
          </NavLink>
          <NavLink to="/stats" style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <Group gap="xs" py={8} c={isActive ? 'blue' : undefined}>
                <IconChartLine size={18} />
                <Text>Stats Explorer</Text>
              </Group>
            )}
          </NavLink>
          <NavLink to="/preferences" style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <Group gap="xs" py={8} c={isActive ? 'blue' : undefined}>
                <IconSettings size={18} />
                <Text>Preferences</Text>
              </Group>
            )}
          </NavLink>
        </ScrollArea>
      </AppShell.Navbar>
      <AppShell.Main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/results" element={<Results />} />
          <Route path="/stats" element={<StatsExplorer />} />
          <Route path="/preferences" element={<Preferences />} />
        </Routes>
      </AppShell.Main>
    </AppShell>
  )
}

export default App

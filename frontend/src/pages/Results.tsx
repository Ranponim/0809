import { Card, Group, Table, Text } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { fetchResults } from '../api/client'
import { formatDateTime } from '../utils/dates'

export default function Results() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['results'],
    queryFn: () => fetchResults({ limit: 100 }),
  })

  return (
    <Card withBorder shadow="sm" p="md">
      <Group justify="space-between" mb="sm">
        <Text fw={600}>Analysis Results</Text>
      </Group>
      {isLoading && <Text size="sm">Loading...</Text>}
      {isError && <Text size="sm" c="red">Failed to load results</Text>}
      {!isLoading && !isError && (
        <Table striped highlightOnHover stickyHeader stickyHeaderOffset={0} withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>User</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Model</Table.Th>
              <Table.Th>Score</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data?.map((row) => (
              <Table.Tr key={row.id}>
                <Table.Td>{row.id}</Table.Td>
                <Table.Td>{row.userId}</Table.Td>
                <Table.Td>{formatDateTime(row.createdAt)}</Table.Td>
                <Table.Td>{row.model ?? '-'}</Table.Td>
                <Table.Td>{row.score ?? '-'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Card>
  )
}
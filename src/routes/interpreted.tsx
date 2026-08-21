import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/interpreted')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/interpreted"!</div>
}

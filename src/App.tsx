import { Button } from '@/components/ui/button'

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8 space-y-4">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--color-accent-green)' }}>
        oimg.app
      </h1>
      <p className="text-muted-foreground">Image optimizer — shell ready.</p>
      <Button>shadcn/ui works</Button>
      <Button variant="outline">Outline variant</Button>
    </div>
  )
}

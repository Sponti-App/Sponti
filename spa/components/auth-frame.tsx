import { Sparkles } from "lucide-react"

export function AuthFrame({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-background">
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pt-8 pb-10">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">sponti</span>
        </div>

        <h1 className="mb-1 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>

        <div className="flex-1">{children}</div>

        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
      </div>
    </div>
  )
}

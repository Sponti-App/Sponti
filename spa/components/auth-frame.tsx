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
    <div className="min-h-dvh w-full bg-background relative overflow-hidden flex flex-col">
      <div className="flex-1 flex flex-col px-6 pt-8 pb-10 overflow-y-auto">
        <div className="flex items-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">sponti</span>
        </div>

        <h1 className="text-2xl font-bold mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>

        <div className="flex-1">{children}</div>

        {footer && <div className="mt-6 text-sm text-center">{footer}</div>}
      </div>
    </div>
  )
}

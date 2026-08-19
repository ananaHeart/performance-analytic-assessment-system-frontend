import { forwardRef } from 'react'

import { cn } from '@/lib/utils'

const Input = forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-70',
      className,
    )}
    {...props}
  />
))

Input.displayName = 'Input'

export { Input }

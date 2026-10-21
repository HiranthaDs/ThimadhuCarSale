"use client";

import { createContext, useContext, useState, type CSSProperties, type ElementType, type ComponentPropsWithoutRef, type ReactNode, type PointerEvent } from "react"
import { motion, useReducedMotion, useSpring } from "motion/react"
import { cn } from "../../lib/utils"

// Adapted from the supplied Aceternity card: preserve the public composition API,
// with bounded spring motion and a static experience for touch/reduced motion.
const MouseEnterContext = createContext<boolean | undefined>(undefined)

export function CardContainer({ children, className, containerClassName, tilt = 6 }: {
  children?: ReactNode
  className?: string
  containerClassName?: string
  tilt?: number
}) {
  const [entered, setEntered] = useState(false)
  const reducedMotion = useReducedMotion()
  const rotateX = useSpring(0, { stiffness: 140, damping: 24, mass: .7 })
  const rotateY = useSpring(0, { stiffness: 140, damping: 24, mass: .7 })

  function reset() {
    setEntered(false)
    rotateX.set(0)
    rotateY.set(0)
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (reducedMotion || event.pointerType !== "mouse" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1))
    const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1))
    setEntered(true)
    rotateX.set(-y * tilt)
    rotateY.set(x * tilt)
    event.currentTarget.style.setProperty("--pointer-x", `${(x + 1) * 50}%`)
    event.currentTarget.style.setProperty("--pointer-y", `${(y + 1) * 50}%`)
  }

  return <MouseEnterContext.Provider value={entered && !reducedMotion}>
    <div className={cn("relative", containerClassName)} style={{ perspective: "1200px" }} onPointerMove={move} onPointerLeave={reset} onPointerCancel={reset}>
      <motion.div className={cn("relative", className)} data-tilted={entered && !reducedMotion} style={{ transformStyle: "preserve-3d", rotateX: reducedMotion ? 0 : rotateX, rotateY: reducedMotion ? 0 : rotateY }}>
        {children}
      </motion.div>
    </div>
  </MouseEnterContext.Provider>
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("relative [transform-style:preserve-3d] [&>*]:[transform-style:preserve-3d]", className)}>{children}</div>
}

type CardItemProps<T extends ElementType> = {
  as?: T
  children?: ReactNode
  className?: string
  translateX?: number | string
  translateY?: number | string
  translateZ?: number | string
  rotateX?: number | string
  rotateY?: number | string
  rotateZ?: number | string
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">

export function CardItem<T extends ElementType = "div">({ as, children, className, translateX = 0, translateY = 0, translateZ = 0, rotateX = 0, rotateY = 0, rotateZ = 0, style, ...rest }: CardItemProps<T>) {
  const entered = useMouseEnter()
  const Tag = as || "div"
  const depthStyle: CSSProperties = {
    transformStyle: "preserve-3d",
    transform: entered ? `translate3d(${translateX}px, ${translateY}px, ${translateZ}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)` : "translate3d(0, 0, 0)",
    ...style,
  }
  return <Tag className={cn("lg-depth-item", className)} style={depthStyle} {...rest}>{children}</Tag>
}

function useMouseEnter() {
  const context = useContext(MouseEnterContext)
  if (context === undefined) throw new Error("useMouseEnter must be used within CardContainer")
  return context
}

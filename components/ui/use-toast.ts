"use client"

// Simplified version for the example
import { useState } from "react"

export function useToast() {
  const [toasts, setToasts] = useState([])

  return {
    toasts,
    toast: (props) => {
      setToasts((prevToasts) => [...prevToasts, { id: Date.now(), ...props }])
    },
    dismiss: (id) => {
      setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id))
    },
  }
}

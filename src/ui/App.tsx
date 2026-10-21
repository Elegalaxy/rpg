import { useEffect } from 'react'
import { debugLog } from './debug.ts'

function App() {
  useEffect(() => {
    debugLog('[ui]', 'app mounted')
  }, [])

  return <h1>RPG – dev build</h1>
}

export default App

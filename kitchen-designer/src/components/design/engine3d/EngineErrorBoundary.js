import React from 'react'

// Catches anything the engine view throws while rendering (the Canvas passes
// errors from inside the three.js tree up to here) and reports it, so the
// designer can fall back to the classic 3D view instead of a blank panel.
export default class EngineErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    if (this.props.onError) this.props.onError(error, info)
  }

  render() {
    if (this.state.error) return this.props.fallback || null
    return this.props.children
  }
}

import { Component } from 'react';
import ErrorPage from '../pages/ErrorPage';

// Without this a render-time throw leaves React unmounting the whole tree, so
// the visitor gets a blank white page (or the raw error overlay in dev). Catch
// it and show the generic error page instead.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorPage variant="error" />;
    }
    return this.props.children;
  }
}

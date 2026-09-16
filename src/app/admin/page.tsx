import { Suspense } from 'react';
import AdminConsole from './AdminConsole';
export default function AdminPage() {
  return <Suspense fallback={<p role="status">正在打开后台…</p>}><AdminConsole /></Suspense>;
}

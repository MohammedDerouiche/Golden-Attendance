
import AdminView from "@/components/views/AdminView";

// Rerouting to /users page which now contains the admin view with a link to active employees
// This page is kept for desktop navigation purposes.
export default function ActivePage() {
  return <AdminView />;
}

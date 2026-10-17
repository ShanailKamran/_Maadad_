import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card">
      <h1>Page not found</h1>
      <p>It may not exist, or you may not have access to it.</p>
      <Link className="btn" href="/">Go home</Link>
    </div>
  );
}

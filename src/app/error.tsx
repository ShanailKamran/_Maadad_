"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card" role="alert">
      <h1>Something went wrong</h1>
      <p>Please try again. If it keeps happening, contact support.</p>
      <button className="btn" onClick={reset}>Try again</button>
    </div>
  );
}

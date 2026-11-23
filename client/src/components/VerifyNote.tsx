export function VerifyNote({ purpose }: { purpose: string }) {
  return (
    <aside className="verify-note">
      <p className="verify-label">Awaiting verification</p>
      <p>{purpose} This box will be replaced after the palace confirms the wording. It is not a historical account.</p>
    </aside>
  )
}

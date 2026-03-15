// Mock TypeScript Frontend Component
// Handles the UI toggle and visual feedback for the 1% donation.

interface CheckoutState {
  subtotal: number;
  isClimateEnabled: boolean;
  contributionAmount: number;
}

const ClimateToggle = (state: CheckoutState, onToggle: (val: boolean) => void) => {
  
  // Calculate the badge visibility and dynamic total
  const displayTotal = state.isClimateEnabled 
    ? state.subtotal + state.contributionAmount 
    : state.subtotal;

  const toggleStyle: Record<string, string> = {
    display: 'flex',
    alignItems: 'center',
    padding: '1rem',
    borderRadius: '8px',
    backgroundColor: state.isClimateEnabled ? '#f0fdf4' : '#f9fafb',
    border: state.isClimateEnabled ? '1px solid #22c55e' : '1px solid #e5e7eb'
  };

  return `
    <div className="stripe-climate-card" style="${Object.entries(toggleStyle).map(([k, v]) => `${k}:${v}`).join(';')}">
      <input 
        type="checkbox" 
        checked="${state.isClimateEnabled}"
        onChange="${(e: any) => onToggle(e.target.checked)}"
      />
      <div style="margin-left: 12px;">
        <p style="font-weight: 600; margin: 0;">Fight climate change</p>
        <p style="font-size: 0.8rem; color: #6b7280; margin: 0;">
          Contribute 1% of your purchase ($${(state.contributionAmount / 100).toFixed(2)}) to carbon removal.
        </p>
      </div>
      <span style="margin-left: auto; font-weight: bold;">
        Total: $${(displayTotal / 100).toFixed(2)}
      </span>
    </div>
  `;
};
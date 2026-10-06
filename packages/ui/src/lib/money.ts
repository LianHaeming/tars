const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })
const gbp0 = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })
export const fmt = (pennies: number) => gbp.format(pennies / 100)
export const fmt0 = (pennies: number) => gbp0.format(pennies / 100)

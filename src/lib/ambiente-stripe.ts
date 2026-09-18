/** Live billing belongs only to the production deployment. */
export function ambienteStripePermitido(chave: string, ambienteVercel: string | undefined): boolean {
  if (/^(?:sk|rk)_live_/.test(chave)) return ambienteVercel === 'production'
  if (/^(?:sk|rk)_test_/.test(chave)) return ambienteVercel !== 'production'
  return false
}

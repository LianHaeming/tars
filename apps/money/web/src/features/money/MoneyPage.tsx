import { Page } from '@tars/ui/components/Page'
import { MoneySection } from './MoneySection'

export function MoneyPage() {
  return (
    <Page title="Money" back={false}>
      <MoneySection />
    </Page>
  )
}

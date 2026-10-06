import { Page } from '@tars/ui/components/Page'
import { MoneySection } from './MoneySection'

export function MoneyPage() {
  return (
    <Page title="Money" back="/apps">
      <MoneySection />
    </Page>
  )
}

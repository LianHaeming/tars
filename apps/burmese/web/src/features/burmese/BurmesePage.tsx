import { Page } from '@tars/ui/components/Page'
import { BurmeseSection } from './BurmeseSection'

export function BurmesePage() {
  return (
    <Page title="Burmese" back={false}>
      <BurmeseSection />
    </Page>
  )
}

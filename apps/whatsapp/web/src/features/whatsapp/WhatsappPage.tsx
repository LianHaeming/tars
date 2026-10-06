import { Page } from '@tars/ui/components/Page'
import { WhatsappSection } from './WhatsappSection'

export function WhatsappPage() {
  return (
    <Page title="WhatsApp" back={false}>
      <WhatsappSection />
    </Page>
  )
}

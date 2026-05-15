import ClickCanvas from './ClickCanvas'
import KeystrokeToast from './KeystrokeToast'
import ZoomLens from './ZoomLens'

export default function Overlay() {
  return (
    <>
      <ClickCanvas />
      <KeystrokeToast />
      <ZoomLens />
    </>
  )
}

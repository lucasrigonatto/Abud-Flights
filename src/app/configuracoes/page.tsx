import { PreferencesForm } from "../../components/preferences-form";
import { requireUser } from "../../lib/auth";

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <PreferencesForm
      currency={user.currency}
      market={user.market}
      quietStartHour={user.quietStartHour}
      quietEndHour={user.quietEndHour}
      digestEnabled={user.digestEnabled}
    />
  );
}

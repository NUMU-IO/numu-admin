/**
 * The bell in the topbar: install the app, and turn on instant notifications.
 *
 * Both live here because they are one decision from an operator's point of
 * view — "I want to know when work arrives without keeping this tab open" —
 * and because on iOS they are literally sequential: Web Push only works from
 * a Home-Screen app, so installing is a prerequisite rather than a nicety.
 *
 * The bell shows a dot when notifications are OFF and the browser could
 * deliver them. That reads backwards for a notification bell, and it is
 * deliberate: there is no in-app inbox behind this control, so an unread count
 * would be a lie. The one thing worth surfacing is that the platform's queues
 * are currently unable to reach anyone.
 */

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/ds";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { isStandalone, usePushNotifications } from "@/hooks/usePushNotifications";
import { sendTestPush } from "@/services/pushApi";
import { toast } from "sonner";

export default function NotificationsMenu() {
  const push = usePushNotifications();
  const install = useInstallPrompt();

  const canOffer = push.available !== false;
  const showDot = canOffer && push.supported && !push.subscribed && !push.blocked;

  const handleToggle = async () => {
    if (push.subscribed) {
      await push.unsubscribe();
      toast.success("Notifications off");
      return;
    }
    const ok = await push.subscribe();
    if (ok) {
      toast.success("Notifications on", {
        description: "You will be alerted when work reaches a queue.",
      });
    } else if (Notification.permission === "denied") {
      toast.error("Blocked by the browser", {
        description: "Allow notifications for this site in your browser settings.",
      });
    } else {
      toast.error("Could not turn notifications on");
    }
  };

  const handleTest = async () => {
    try {
      const result = await sendTestPush();
      if (result.queued) {
        toast.success("Test sent", { description: "It should arrive in a moment." });
      } else {
        toast.error("Push is not configured on this environment");
      }
    } catch {
      toast.error("Could not send the test");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="ak-bell numu-focus-ring"
          aria-label={
            push.subscribed
              ? "Notifications are on. Open notification settings."
              : "Notifications are off. Open notification settings."
          }
        >
          <Icon name="bell" size={18} />
          {showDot ? <span className="ak-bell__dot" aria-hidden="true" /> : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Instant notifications</DropdownMenuLabel>

        <div className="ak-bell__note">
          {push.available === false
            ? "This environment has no push keys configured, so nothing can be delivered."
            : push.needsInstallFirst
              ? "On iPhone and iPad, add this to your Home Screen first — Safari only delivers notifications to an installed app."
              : !push.supported
                ? "This browser cannot receive push notifications."
                : push.blocked
                  ? "Blocked in your browser settings. Allow notifications for this site, then try again."
                  : push.subscribed
                    ? "You will be alerted when a merchant needs a decision — access requests, payment proofs, theme reviews and new leads."
                    : "Get alerted when work reaches a queue, without keeping this tab open."}
        </div>

        {push.supported && !push.blocked && push.available !== false ? (
          <DropdownMenuItem
            onSelect={(event) => {
              // Radix closes the menu on select, which tears the trigger out of
              // the call stack. iOS requires requestPermission() to run inside
              // the gesture, so the menu has to stay open until it resolves.
              event.preventDefault();
              void handleToggle();
            }}
            disabled={push.busy}
          >
            {push.subscribed ? "Turn off on this device" : "Turn on for this device"}
          </DropdownMenuItem>
        ) : null}

        {push.subscribed ? (
          <DropdownMenuItem onSelect={() => void handleTest()}>
            Send a test notification
          </DropdownMenuItem>
        ) : null}

        {install.promptable || (!isStandalone() && push.needsInstallFirst) ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Install</DropdownMenuLabel>
            {install.promptable ? (
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  void install.install();
                }}
              >
                Install NUMU Admin
              </DropdownMenuItem>
            ) : (
              <div className="ak-bell__note">
                Tap Share, then “Add to Home Screen”.
              </div>
            )}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

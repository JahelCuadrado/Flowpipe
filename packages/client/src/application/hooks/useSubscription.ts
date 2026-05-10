import { useState, useEffect, useCallback } from "react";
import { database } from "@/infrastructure/database/AppDatabase";
import type { SubscriptionEntity } from "@/domain/entities/LocalEntities";

interface UseSubscriptionResult {
  readonly isSubscribed: boolean;
  readonly loading: boolean;
  toggle(): Promise<void>;
}

/**
 * Manages subscribe/unsubscribe state for a channel.
 * Reads and writes the Dexie subscriptions table.
 */
export function useSubscription(
  serviceId: number,
  channelUrl: string | null,
  channelName: string,
  avatarUrl: string | null = null,
  subscriberCount: number | null = null,
  description: string | null = null
): UseSubscriptionResult {
  const [subscription, setSubscription] = useState<SubscriptionEntity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!channelUrl) {
      setLoading(false);
      return;
    }

    database.subscriptions
      .where("[serviceId+url]")
      .equals([serviceId, channelUrl])
      .first()
      .then((sub) => {
        setSubscription(sub ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [serviceId, channelUrl]);

  const toggle = useCallback(async () => {
    if (!channelUrl) return;

    if (subscription) {
      if (subscription.id !== undefined) {
        await database.subscriptions.delete(subscription.id);
      }
      setSubscription(null);
    } else {
      const id = await database.subscriptions.add({
        serviceId,
        url: channelUrl,
        name: channelName,
        avatarUrl,
        subscriberCount,
        description,
        notificationMode: 0,
      });
      setSubscription({
        id,
        serviceId,
        url: channelUrl,
        name: channelName,
        avatarUrl,
        subscriberCount,
        description,
        notificationMode: 0,
      });
    }
  }, [channelUrl, channelName, avatarUrl, subscriberCount, description, serviceId, subscription]);

  return {
    isSubscribed: subscription !== null,
    loading,
    toggle,
  };
}

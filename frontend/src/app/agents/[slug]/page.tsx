'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { StarIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AgentPublicProfile {
  displayName: string;
  bio: string | null;
  actionZone: string | null;
  missionCount: number;
  avgRating: number | null;
  reviewCount: number;
  memberSince: string;
  isPro: boolean;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export default function AgentPubliquePage() {
  const params = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<AgentPublicProfile | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ profile: AgentPublicProfile; reviews: ReviewItem[] }>(
        `/api/agents/${params.slug}`,
      );
      setProfile(res.profile);
      setReviews(res.reviews);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Une erreur est survenue.');
      }
    }
  }, [params.slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (notFound) {
    return <p className="text-sm text-muted-foreground">Agent introuvable.</p>;
  }
  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  }
  if (!profile) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{profile.displayName}</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <Badge>Agent vérifié</Badge>
          {profile.isPro && <Badge variant="secondary">Agent Pro</Badge>}
          {profile.actionZone && <span>· {profile.actionZone}</span>}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 py-4 text-sm">
          <div>
            <p className="font-medium">
              {profile.avgRating ? `${profile.avgRating.toFixed(1)}/5` : 'Pas encore noté'}
            </p>
            <p className="text-muted-foreground">{profile.reviewCount} avis</p>
          </div>
          <div>
            <p className="font-medium">{profile.missionCount}</p>
            <p className="text-muted-foreground">
              mission{profile.missionCount > 1 ? 's' : ''} réalisée
              {profile.missionCount > 1 ? 's' : ''}
            </p>
          </div>
          <div>
            <p className="font-medium">
              {new Date(profile.memberSince).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
              })}
            </p>
            <p className="text-muted-foreground">membre depuis</p>
          </div>
        </CardContent>
      </Card>

      {profile.bio && (
        <Card>
          <CardContent className="py-4 text-sm whitespace-pre-line">{profile.bio}</CardContent>
        </Card>
      )}

      {reviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avis</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <StarIcon
                        key={n}
                        className={cn(
                          'size-3.5',
                          n <= r.rating ? 'fill-primary text-primary' : 'text-muted-foreground',
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString('fr-FR', {
                      dateStyle: 'medium',
                    })}
                  </span>
                </div>
                {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

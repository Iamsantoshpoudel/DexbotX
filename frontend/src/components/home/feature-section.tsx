import Image from 'next/image';
import Link from 'next/link';
import {
  Bot,
  Code2,
  LayoutDashboard,
  Music2,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/misc';

type HomeFeature = Readonly<{
  name: string;
  description: string;
  href: string;
}>;

const FEATURE_ICONS: Record<string, LucideIcon> = {
  Moderation: ShieldCheck,
  'Welcome and Goodbye': UsersRound,
  'Auto Roles': Bot,
  'Anti-Spam': ShieldAlert,
  'Social Notifications': Radio,
  'AI Auto Chat': Sparkles,
  '24/7 Music (Planned)': Music2,
  'Web Dashboard': LayoutDashboard,
  'Open Source and Free': Code2,
};

const FEATURE_IMAGES = {
  Moderation: [{
    src: '/assets/moderationDexbotx.png',
    alt: 'DexBotX moderation tools interface',
    width: 1592,
    height: 912,
    fit: 'cover',
  }],
  'Auto Roles': [{
    src: '/assets/AutoRoleManageDexbotx.png',
    alt: 'Discord role selection interface',
    width: 1616,
    height: 896,
    fit: 'cover',
  }],
  'Welcome and Goodbye': [
    {
      src: '/assets/welcomeCardDexbotx.jpg',
      alt: 'DexBotX welcome card',
      width: 605,
      height: 417,
      fit: 'contain',
    },
    {
      src: '/assets/goodbyeCardDexbotx.jpg',
      alt: 'DexBotX goodbye card',
      width: 1480,
      height: 1000,
      fit: 'contain',
    },
  ],
} as const;

function FeatureHighlight({
  feature,
  images,
  reverse = false,
}: {
  feature: HomeFeature;
  images: (typeof FEATURE_IMAGES)[keyof typeof FEATURE_IMAGES];
  reverse?: boolean;
}) {
  const Icon = FEATURE_ICONS[feature.name];

  return (
    <article className="grid items-center gap-8 rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-5 shadow-[0_20px_70px_rgba(0,0,0,0.2)] sm:p-8 lg:grid-cols-2 lg:gap-12 lg:p-10">
      <div className={reverse ? 'lg:order-2' : undefined}>
        <div className="mb-5 grid size-12 place-items-center border border-white/10 bg-white/[0.06] text-white/80">
          <Icon aria-hidden="true" className="size-6" />
        </div>
        <h3 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{feature.name}</h3>
        <p className="mt-4 max-w-xl leading-7 text-white/65">{feature.description}</p>
        <Link
          href={feature.href}
          className="mt-5 inline-flex min-h-11 items-center rounded-md text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline-white"
        >
          Explore {feature.name.toLowerCase()}
        </Link>
      </div>
      <div className={`grid ${images.length > 1 ? 'grid-cols-2 gap-3' : ''} items-center transition duration-300 hover:-translate-y-1 ${reverse ? 'lg:order-1' : ''}`}>
        {images.map((image) => (
          <div
            key={image.src}
            className="relative overflow-hidden"
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes={images.length > 1 ? '(min-width: 1024px) 24vw, 50vw' : '(min-width: 1024px) 48vw, 100vw'}
              className="h-full w-full"
              style={{ objectFit: image.fit }}
            />
          </div>
        ))}
      </div>
    </article>
  );
}

function FeatureCard({ feature }: { feature: HomeFeature }) {
  const Icon = FEATURE_ICONS[feature.name];

  return (
    <Card className="group h-full rounded-2xl border-white/10 bg-white/[0.045] p-6 text-white transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.075] hover:shadow-[0_18px_45px_rgba(0,0,0,0.25)]">
      <div className="mb-5 grid size-11 place-items-center bg-white/[0.06] text-white/80 transition group-hover:bg-white/10">
        <Icon aria-hidden="true" className="size-5" />
      </div>
      <h3 className="font-semibold">{feature.name}</h3>
      <p className="mt-2 text-sm leading-6 text-white/65">{feature.description}</p>
      <Link
        href={feature.href}
        className="mt-4 inline-flex min-h-11 items-center rounded-md text-sm font-medium text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline-white"
      >
        Explore {feature.name.toLowerCase()}
      </Link>
    </Card>
  );
}

export function HomeFeatureSection({ features }: { features: readonly HomeFeature[] }) {
  const hasFeatureImage = (feature: HomeFeature): feature is HomeFeature & { name: keyof typeof FEATURE_IMAGES } =>
    feature.name in FEATURE_IMAGES;
  const highlights = features.filter(hasFeatureImage);
  const remainingFeatures = features.filter((feature) => !hasFeatureImage(feature));

  return (
    <section id="features" aria-labelledby="features-heading" className="mx-auto max-w-7xl scroll-mt-24 px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-4xl text-center">
        <h2 id="features-heading" className="text-balance text-4xl font-extrabold leading-tight tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
          <span className="text-white">Every Tools</span>{' '}
          <span className="font-semibold text-white/75">you need to grow your</span>{' '}
          <span className="text-white">community server</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/65">
          DexBotX brings community management tools together. Explore a feature to see how it fits into your server setup.
        </p>
      </div>
      <div className="mt-10 space-y-6">
        {highlights.map((feature) => (
          <FeatureHighlight
            key={feature.name}
            feature={feature}
            images={FEATURE_IMAGES[feature.name]}
            reverse={feature.name === 'Auto Roles'}
          />
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {remainingFeatures.map((feature) => (
          <FeatureCard key={feature.name} feature={feature} />
        ))}
      </div>
    </section>
  );
}

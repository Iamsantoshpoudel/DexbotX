import Image from 'next/image';

export function Loader() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background" role="status" aria-label="Loading">
      <Image src="/loading.svg" alt="" width={96} height={97} priority />
    </div>
  );
}

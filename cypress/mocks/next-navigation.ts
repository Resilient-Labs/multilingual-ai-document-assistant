export const useRouter = () => ({
  push: () => {},
  replace: () => {},
  prefetch: () => {},
  back: () => {},
  forward: () => {},
  refresh: () => {},
})

export const usePathname = () => '/'
export const useSearchParams = () => new URLSearchParams()

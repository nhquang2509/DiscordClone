// Tell TypeScript that importing a .css file is valid (handled by Next.js bundler)
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

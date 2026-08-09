declare module 'content-collections' {
  export type Post = {
    title: string;
    description: string;
    published: string;
    authors: string[];
    category: string;
    image?: string;
    content: string;
    slug: string;
    _meta: {
      fileName: string;
      filePath: string;
      directory: string;
      path: string;
      extension: string;
    };
  };

  export const allPosts: Post[];

  export type Release = {
    version: string;
    date: string;
    title: string;
    tags: string[];
    content: string;
    slug: string;
    _meta: {
      fileName: string;
      filePath: string;
      directory: string;
      path: string;
      extension: string;
    };
  };

  export const allReleases: Release[];
}

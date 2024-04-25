export interface Library {
    link: string;
    code: string;
    path: string;
    name: string;
    description: string;
    resource_sharing: false;
    campus: {
      desc: string;
      value: string;
    };
    proxy: string;
    default_location: {
      desc: string;
      value: string;
    };
  }
  
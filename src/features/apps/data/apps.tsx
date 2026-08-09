import {
  IconDiscord,
  IconDocker,
  IconFigma,
  IconGithub,
  IconGitlab,
  IconGmail,
  IconNotion,
  IconSlack,
  IconStripe,
  IconTelegram,
  IconTrello,
  IconWhatsapp,
  IconZoom
} from '@/assets/brand-icons';

export type App = {
  name: string;
  logo: React.ReactNode;
  connected: boolean;
  desc: string;
};

export const apps: App[] = [
  {
    name: 'Telegram',
    logo: <IconTelegram />,
    connected: false,
    desc: 'Connect with Telegram for real-time communication.'
  },
  {
    name: 'Notion',
    logo: <IconNotion />,
    connected: true,
    desc: 'Effortlessly sync Notion pages for seamless collaboration.'
  },
  {
    name: 'Figma',
    logo: <IconFigma />,
    connected: true,
    desc: 'View and collaborate on Figma designs in one place.'
  },
  {
    name: 'Trello',
    logo: <IconTrello />,
    connected: false,
    desc: 'Sync Trello cards for streamlined project management.'
  },
  {
    name: 'Slack',
    logo: <IconSlack />,
    connected: false,
    desc: 'Integrate Slack for efficient team communication.'
  },
  {
    name: 'Zoom',
    logo: <IconZoom />,
    connected: true,
    desc: 'Host Zoom meetings directly from the dashboard.'
  },
  {
    name: 'Stripe',
    logo: <IconStripe />,
    connected: false,
    desc: 'Easily manage Stripe transactions and payments.'
  },
  {
    name: 'Gmail',
    logo: <IconGmail />,
    connected: true,
    desc: 'Access and manage Gmail messages effortlessly.'
  },
  {
    name: 'Discord',
    logo: <IconDiscord />,
    connected: false,
    desc: 'Connect with Discord for seamless community communication.'
  },
  {
    name: 'GitHub',
    logo: <IconGithub />,
    connected: false,
    desc: 'Streamline code management with GitHub integration.'
  },
  {
    name: 'GitLab',
    logo: <IconGitlab />,
    connected: false,
    desc: 'Efficiently manage code projects with GitLab integration.'
  },
  {
    name: 'Docker',
    logo: <IconDocker />,
    connected: false,
    desc: 'Effortlessly manage Docker containers on your dashboard.'
  },
  {
    name: 'WhatsApp',
    logo: <IconWhatsapp />,
    connected: false,
    desc: 'Easily integrate WhatsApp for direct messaging.'
  }
];

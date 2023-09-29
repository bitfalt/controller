import { DiscordIcon, GitHubIcon, TwitterIcon } from "../components/icons";
import { Dropdown } from "../components/menu/Dropdown";
import { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof Dropdown> = {
  title: "Dropdown",
  component: Dropdown,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof Dropdown>;

export const Example: Story = {
  args: {
    items: [
      {
        label: "Twitter",
        icon: <TwitterIcon boxSize={6} />,
        onClick: () => console.log("clicked"),
      },
      {
        label: "Discord",
        icon: <DiscordIcon boxSize={6} />,
        onClick: () => console.log("clicked"),
      },
      {
        label: "GitHub",
        icon: <GitHubIcon boxSize={6} />,
        onClick: () => console.log("clicked"),
      },
    ],
    showCaret: true,
  },
};

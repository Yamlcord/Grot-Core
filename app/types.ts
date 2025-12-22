import { ButtonBuilder, ButtonInteraction, ChatInputCommandInteraction, Collection, GatewayIntentBits, Message, ModalSubmitInteraction, SlashCommandBuilder, StringSelectMenuInteraction } from "discord.js";
import { GrotCore } from ".";

export enum MessageTypes {
  PlainText = 0,
  Embed = 1,
  ComponentsV2 = 2,
}

export interface Plugin {
  name: string;
  dependencies?: Array<string>;
  requiredIntents?: GatewayIntentBits[];
  migrationsPath: string;
  initialize(core: GrotCore): void;
}

export enum ActionTypes {
  SlashCommand = "slash",
  PrefixCommand = "prefix",
  Button = "button",
  SelectMenu = "selectMenu",
  Modal = "modal",
}

export interface RunOptions {
  clientId: string;
  guildId: string;
  token: string;
}


export type SlashCommandActionData = {
  type: ActionTypes.SlashCommand;
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void;
};


export type PrefixCommandActionData = {
  type: ActionTypes.PrefixCommand;
  execute: (message: Message, ...params: any[]) => Promise<void> | void;
};

export type ButtonActionData = {
  type: ActionTypes.Button;
  name: string;
  view: (buttonBuilder: ButtonBuilder) => ButtonBuilder;
  execute: (interaction: ButtonInteraction) => Promise<void> | void;
};

export type SelectMenuActionData = {
  type: ActionTypes.SelectMenu;
  execute: (interaction: StringSelectMenuInteraction) => Promise<void> | void;
};

export type ModalActionData = {
  type: ActionTypes.Modal;
  execute: (interaction: ModalSubmitInteraction) => Promise<void> | void;
};

export type ActionTypeMap = {
  [ActionTypes.SlashCommand]: SlashCommandActionData;
  [ActionTypes.PrefixCommand]: PrefixCommandActionData;
  [ActionTypes.Button]: ButtonActionData;
  [ActionTypes.SelectMenu]: SelectMenuActionData;
  [ActionTypes.Modal]: ModalActionData;
};


export type ActionData =
  | SlashCommandActionData
  | PrefixCommandActionData
  | ButtonActionData
  | SelectMenuActionData
  | ModalActionData;

export type ActionRegistry = {
  buttons: Collection<string, ButtonActionData>;
  selects: Collection<string, SelectMenuActionData>;
  modals: Collection<string, ModalActionData>;
  commands: {
    slash: Collection<string, SlashCommandActionData>;
    prefix: Collection<string, PrefixCommandActionData>;
  };
};
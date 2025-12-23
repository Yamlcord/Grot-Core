import { Collection } from "discord.js";
import {
    SlashCommandActionData,
    PrefixCommandActionData,
    ButtonActionData,
    SelectMenuActionData,
    ModalActionData,
    ActionTypes,
    ActionData,
} from "./types";

export class ActionRegistry {
    private commands = {
        slash: new Collection<string, SlashCommandActionData>(),
        prefix: new Collection<string, PrefixCommandActionData>(),
    };

    private buttons = new Collection<string, ButtonActionData>();
    private selects = new Collection<string, SelectMenuActionData>();
    private modals = new Collection<string, ModalActionData>();

    public getSlashCommands = () => this.commands.slash;

    set(data: SlashCommandActionData): void;
    set(data: PrefixCommandActionData): void;
    set(data: ButtonActionData): void;
    set(data: SelectMenuActionData): void;
    set(data: ModalActionData): void;
    set(data: ActionData): void;

    set(data: ActionData): void {
        switch (data.type) {
            case ActionTypes.SlashCommand:
                this.commands.slash.set(
                    data.data.name,
                    data,
                );
                break;

            case ActionTypes.PrefixCommand:
                this.commands.prefix.set(data.name, data);
                break;

            case ActionTypes.Button:
                this.buttons.set(data.name, data);
                break;

            case ActionTypes.SelectMenu:
                this.selects.set(data.name, data)
                break;

            case ActionTypes.Modal:
                this.modals.set(data.name, data)
                break;
        }
    }

    get(type: ActionTypes.SlashCommand, name: string): SlashCommandActionData | undefined;
    get(type: ActionTypes.PrefixCommand, name: string): PrefixCommandActionData | undefined;
    get(type: ActionTypes.Button, name: string): ButtonActionData | undefined;
    get(type: ActionTypes.SelectMenu, name: string): SelectMenuActionData | undefined;
    get(type: ActionTypes.Modal, name: string): ModalActionData | undefined;
    get(type: ActionTypes, name: string): ActionData | undefined;

    get(type: ActionTypes, name: string) {
        switch (type) {
            case ActionTypes.SlashCommand:
                return this.commands.slash.get(name);

            case ActionTypes.PrefixCommand:
                return this.commands.prefix.get(name);

            case ActionTypes.Button:
                return this.buttons.get(name);

            case ActionTypes.SelectMenu:
                return this.selects.get(name);

            case ActionTypes.Modal:
                return this.modals.get(name);
        }
    }
}

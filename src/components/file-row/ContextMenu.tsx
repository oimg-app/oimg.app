import {Icons} from "@/components/icons";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuGroup,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"

type ContextMenuProps = {
    file: {
        id: string
        name: string
    }
}

export function ContextMenu(_: ContextMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                <span
                    className="ctxbtn"
                    title="More"
                >
                    <Icons.More size={12}/>
                </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-50" align="start">
                <DropdownMenuGroup>
                    <DropdownMenuItem className="pi">
                        <Icons.Play size={13}/><span>Re-optimize</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="pi">
                        <Icons.Download size={13}/><span>Save as…</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="pi">
                        <Icons.Copy size={13}/><span>Copy data URI</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="pi">
                        <Icons.Code size={13}/><span>Copy &lt;picture&gt;</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                    <DropdownMenuItem variant="destructive" className="pi danger">
                        <Icons.Trash size={13}/><span>Remove from queue</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>

            </DropdownMenuContent>
        </DropdownMenu>
    )
}

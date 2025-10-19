'use client'


import {NAV_ITEMS} from "@/lib/constants";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {cn} from "@/lib/utils";

interface NavItemsProps {
    className?: string;
}

const NavItems = ({ className }: NavItemsProps) => {
    const pathname = usePathname()

    const isActive = (path: string) => {
        if (path === '/') return pathname === '/';
        return pathname.startsWith(path);
    }

    return (
        <ul className={cn("flex flex-col sm:flex-row gap-3 sm:gap-8 font-medium", className)}>
            {NAV_ITEMS.map(({href, label}) => (
                <li key={href}>
                    <Link
                        href={href}
                        className={`transition-colors hover:text-yellow-500 ${
                            isActive(href) ? 'text-gray-100' : 'text-gray-400'
                        }`}
                    >
                        {label}
                    </Link>
                </li>
            ))}
        </ul>
    )
}
export default NavItems

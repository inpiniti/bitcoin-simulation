import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
} from "@/components/ui/alert-dialog"
import { useStore } from "@/store/useStore"

export function GlobalAlertDialog() {
    const { globalError, setGlobalError } = useStore()

    const isOpen = !!globalError

    const handleClose = () => {
        setGlobalError(null)
    }

    // globalError가 문자열이면 description으로, 객체면 title/description 분리
    const title = typeof globalError === 'string' ? '알림' : globalError?.title || '알림'
    const description = typeof globalError === 'string' ? globalError : globalError?.description || ''

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription className="whitespace-pre-wrap">
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction onClick={handleClose}>확인</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}

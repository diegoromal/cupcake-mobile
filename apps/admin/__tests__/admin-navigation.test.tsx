import { render, screen } from '@testing-library/react';
import AdminHeader from '@/components/AdminHeader';
let pathname='/categorias/nova';
jest.mock('next/navigation',()=>({usePathname:()=>pathname,useRouter:()=>({push:jest.fn()})}));
jest.mock('@/lib/client/admin-api',()=>({adminApi:jest.fn()}));
test('navegação semântica, aria-current e sair',()=>{
 const view=render(<AdminHeader/>);expect(screen.getByRole('navigation',{name:'Administração'})).toBeInTheDocument();
 expect(screen.getByRole('link',{name:'Categorias'})).toHaveAttribute('aria-current','page');
 expect(screen.getByRole('link',{name:'Produtos'})).not.toHaveAttribute('aria-current');
 expect(screen.getByRole('button',{name:'Sair'})).toBeInTheDocument();
 pathname='/personalizacoes';view.rerender(<AdminHeader/>);expect(screen.getByRole('link',{name:'Personalizações'})).toHaveAttribute('aria-current','page');
});

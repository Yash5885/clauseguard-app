import {render,screen} from '@testing-library/react';
import Home from '../app/page';
test('introduces the product',()=>{render(<Home/>);expect(screen.getByRole('heading',{name:'ClauseGuard'})).toBeInTheDocument();});

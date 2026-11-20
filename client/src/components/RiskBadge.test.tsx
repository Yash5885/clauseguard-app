import {render,screen} from '@testing-library/react';
import {RiskBadge} from './RiskBadge';
test.each(['safe','caution','risky'] as const)('renders %s risk with text and an accessible label',risk=>{render(<RiskBadge risk={risk}/>);expect(screen.getByLabelText(`Risk level: ${risk}`)).toHaveTextContent(new RegExp(risk,'i'));});

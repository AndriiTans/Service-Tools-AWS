import { Outlet } from 'react-router-dom';

const ProtectedLayout = () => {
  return (
    // <div>
    //   <header>
    //     <h1>Protected Header</h1>
    //   </header>
    //   <main>
    <Outlet />
    //   </main>
    //   <footer>
    //     <p>Protected Footer</p>
    //   </footer>
    // </div>
  );
};

export default ProtectedLayout;
